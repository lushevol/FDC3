import { FDC3Server } from './FDC3Server';
import { AppRegistration, InstanceID, ServerContext, State } from './ServerContext';
import { BroadcastHandler, ChannelState } from './handlers/BroadcastHandler';
import { IntentHandler } from './handlers/IntentHandler';
import { Directory } from './directory/DirectoryInterface';
import { OpenHandler } from './handlers/OpenHandler';
import { HeartbeatHandler } from './handlers/HeartbeatHandler';
import {
  AppRequestMessage,
  WebConnectionProtocol4ValidateAppIdentity,
  WebConnectionProtocol6Goodbye,
} from '@finos/fdc3-schema/dist/generated/api/BrowserTypes';

export interface MessageHandler {
  /**
   * Handles an AgentRequestMessage from the messaging source. This function
   * is called by BasicFDC3Server on every message received and should only
   * process those it supports.
   */
  accept(
    msg: AppRequestMessage | WebConnectionProtocol4ValidateAppIdentity | WebConnectionProtocol6Goodbye,
    sc: ServerContext<AppRegistration>,
    from: InstanceID
  ): Promise<void>;

  /**
   * Clean-up any state relating to a instance that has disconnected.
   */
  cleanup(instanceId: InstanceID, sc: ServerContext<AppRegistration>): void;

  shutdown(): void;
}

/**
 * `BasicFDC3Server` is the hub that glues messaging transports to handler modules.
 *
 * Every inbound Web Connection Protocol message is fanned out to the registered {@link MessageHandler}s. Each handler owns
 * a slice of behaviour (broadcast, intents, open, heartbeat) and decides whether it can process the message. Keeping the
 * server thin ensures new message types can be added by dropping in another handler without touching the core routing logic.
 *
 * Shared cross-session state is stored in the {@link ServerContext}; the server simply coordinates cleanup and shutdown so that
 * disconnected app instances do not leak listeners or pending promises.
 */
export class BasicFDC3Server implements FDC3Server {
  readonly handlers: MessageHandler[];
  private sc: ServerContext<AppRegistration>;

  constructor(handlers: MessageHandler[], sc: ServerContext<AppRegistration>) {
    this.handlers = handlers;
    this.sc = sc;
  }

  cleanup(instanceId: InstanceID): void {
    this.handlers.forEach(handler => handler.cleanup(instanceId, this.sc));
    this.sc.setAppState(instanceId, State.Terminated);
  }

  async receive(
    message: AppRequestMessage | WebConnectionProtocol4ValidateAppIdentity | WebConnectionProtocol6Goodbye,
    from: InstanceID
  ): Promise<void> {
    // Handlers run in parallel to avoid blocking discovery of slow operations. We intentionally ignore rejections here because
    // each handler reports protocol errors through the context (e.g. `errorResponse`). Collecting with `allSettled` prevents one
    // failure from starving unrelated operations.
    const promises = this.handlers.map(h => h.accept(message, this.sc, from));
    await Promise.allSettled(promises);
  }

  shutdown(): void {
    this.handlers.forEach(h => h.shutdown());
  }
}

export class DefaultFDC3Server extends BasicFDC3Server {
  constructor(
    sc: ServerContext<AppRegistration>,
    directory: Directory,
    userChannels: ChannelState[],
    heartbeats: boolean,
    intentTimeoutMs: number = 20000,
    openHandlerTimeoutMs: number = 10000
  ) {
    const handlers: MessageHandler[] = [
      new BroadcastHandler(userChannels),
      new IntentHandler(directory, intentTimeoutMs),
      new OpenHandler(directory, openHandlerTimeoutMs),
    ];

    if (heartbeats) {
      handlers.push(new HeartbeatHandler(openHandlerTimeoutMs / 10, openHandlerTimeoutMs / 2, openHandlerTimeoutMs));
    }

    super(handlers, sc);
  }
}
