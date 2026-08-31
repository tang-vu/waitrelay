import {
  FlightPortConnectSchema,
  FlightToHostMessageSchema,
  HostToFlightMessageSchema,
  makeBridgeEnvelope,
  type FlightPortConnect,
  type FlightToHostMessage,
  type HostToFlightMessage,
} from "./contracts";

export type HostBridgeOptions = {
  iframe: HTMLIFrameElement;
  connect: FlightPortConnect;
  onMessage: (message: FlightToHostMessage) => void;
  onCrossBoundary?: (direction: "host-to-flight" | "flight-to-host", payload: unknown) => void;
};

export type FlightHostBridge = {
  send: (message: HostToFlightMessage) => boolean;
  destroy: () => void;
};

/**
 * Opens a run-scoped MessageChannel. targetOrigin is necessarily `*` for a
 * sandbox without allow-same-origin, so the receiving side validates
 * event.source, the transferred port, run ID, nonce, and every payload.
 */
export function connectFlightHost(options: HostBridgeOptions): FlightHostBridge {
  const connect = FlightPortConnectSchema.parse(options.connect);
  const channel = new MessageChannel();
  let active = true;

  channel.port1.onmessage = (event: MessageEvent<unknown>) => {
    if (!active) return;
    const parsed = FlightToHostMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    if (parsed.data.runId !== connect.runId || parsed.data.nonce !== connect.nonce) return;
    options.onCrossBoundary?.("flight-to-host", parsed.data);
    options.onMessage(parsed.data);
  };
  channel.port1.start();

  const flightWindow = options.iframe.contentWindow;
  if (!flightWindow) {
    channel.port1.close();
    channel.port2.close();
    return { send: () => false, destroy: () => undefined };
  }

  options.onCrossBoundary?.("host-to-flight", connect);
  flightWindow.postMessage(connect, "*", [channel.port2]);

  return {
    send(message) {
      if (!active) return false;
      const parsed = HostToFlightMessageSchema.safeParse(message);
      if (!parsed.success) return false;
      if (parsed.data.runId !== connect.runId || parsed.data.nonce !== connect.nonce) return false;
      options.onCrossBoundary?.("host-to-flight", parsed.data);
      channel.port1.postMessage(parsed.data);
      return true;
    },
    destroy() {
      active = false;
      channel.port1.onmessage = null;
      channel.port1.close();
    },
  };
}

type FlightClientPayload = FlightToHostMessage extends infer Message
  ? Message extends FlightToHostMessage
    ? Omit<Message, "bridgeVersion" | "runId" | "nonce">
    : never
  : never;

export type FlightClientConnection = {
  connect: FlightPortConnect;
  send: (message: FlightClientPayload) => boolean;
  destroy: () => void;
};

export type FlightClientOptions = {
  onConnect: (connection: FlightClientConnection) => void;
  onMessage: (message: HostToFlightMessage) => void;
  onCrossBoundary?: (direction: "host-to-flight" | "flight-to-host", payload: unknown) => void;
};

/** Installs the flight-side listener. It accepts exactly one valid parent port. */
export function acceptFlightClient(options: FlightClientOptions): () => void {
  let accepted = false;
  let activePort: MessagePort | undefined;

  const onWindowMessage = (event: MessageEvent<unknown>) => {
    if (accepted || event.source !== window.parent || event.ports.length !== 1) return;
    const parsed = FlightPortConnectSchema.safeParse(event.data);
    if (!parsed.success) return;

    accepted = true;
    const connect = parsed.data;
    const port = event.ports[0];
    activePort = port;
    port.onmessage = (portEvent: MessageEvent<unknown>) => {
      const message = HostToFlightMessageSchema.safeParse(portEvent.data);
      if (!message.success) return;
      if (message.data.runId !== connect.runId || message.data.nonce !== connect.nonce) return;
      options.onCrossBoundary?.("host-to-flight", message.data);
      options.onMessage(message.data);
    };
    port.start();

    const connection: FlightClientConnection = {
      connect,
      send(message) {
        const enveloped = makeBridgeEnvelope(connect, message);
        const validated = FlightToHostMessageSchema.safeParse(enveloped);
        if (!validated.success || activePort !== port) return false;
        options.onCrossBoundary?.("flight-to-host", validated.data);
        port.postMessage(validated.data);
        return true;
      },
      destroy() {
        if (activePort === port) activePort = undefined;
        port.onmessage = null;
        port.close();
      },
    };

    options.onCrossBoundary?.("host-to-flight", connect);
    options.onConnect(connection);
    connection.send({ type: "flight.ready" });
  };

  window.addEventListener("message", onWindowMessage);
  return () => {
    window.removeEventListener("message", onWindowMessage);
    if (activePort) {
      activePort.onmessage = null;
      activePort.close();
    }
    activePort = undefined;
  };
}
