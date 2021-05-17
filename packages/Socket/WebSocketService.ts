import {Event, IDisposables, IDispose} from '../../utils/event';
import {Service} from '../ServiceManager';
import {ISocketCoreConfig, SocketCore, SOCKET_STATUS} from './WebSocket';

interface ISocketResponse<T> {
    subscribe(d: (c: T) => void): IDispose;
}

export interface ISocketServiceConfig {
    cache?: {namespace: string};
}

export class SocketService extends Service {
    private disposables: IDisposables = new Set();
    constructor(
        private _sender: SocketCore,
        private _opt: ISocketServiceConfig = {},
    ) {
        super();
    }

    static create(url: string, opts?: ISocketCoreConfig) {
        return new SocketService(new SocketCore(url, opts));
    }

    public event(type: SOCKET_STATUS) {
        if (!this._sender.hooks.get(type)) {
            this._sender.hooks.register(type);
        }
        return this._sender.hooks.get(type).event;
    }

    private get _onMessage(): Event {
        return this.event(SOCKET_STATUS.message);
    }

    private get _onError(): Event {
        return this.event(SOCKET_STATUS.error);
    }

    public onMessage<T>(callback: (d: T) => void): IDispose {
        return this._onMessage(callback);
    }

    public onError(callback: (e: any) => void): IDispose {
        return this._onError(callback);
    }

    public onConnect(callback: () => void): IDispose {
        return this._sender.hooks.on(SOCKET_STATUS.connect, callback);
    }

    public onDisconnect(callback: (e: any) => void): IDispose {
        return this._sender.hooks.on(SOCKET_STATUS.disconnect, callback);
    }

    public onReconnect(callback: (e: any) => void): IDispose {
        return this._sender.hooks.on(SOCKET_STATUS.reconnect, callback);
    }

    call(name: string) {
        return Promise.resolve(name);
    }

    private _send(params: any) {
        this._sender.send(JSON.stringify(params));
    }

    public send(params: any): Event {
        this._send(params);
        return this._onMessage;
    }

    public once<T>(
        params: any,
        filter?: (d: T) => boolean,
    ): ISocketResponse<T> {
        const event = filter
            ? Event.filter(this.send(params), filter)
            : this.send(params);
        return {
            subscribe(callback: (d: T) => void) {
                return event(function (e) {
                    callback(e);
                });
            },
        };
    }

    public on<T>({
        subMsg,
        filter,
        unsubMsg,
    }: {
        subMsg: any;
        filter?(d: T): boolean;
        unsubMsg?: any;
    }): ISocketResponse<T> {
        const event = filter
            ? Event.filter(this.send(subMsg), filter)
            : this.send(subMsg);
        return {
            subscribe: (callback: (d: T) => void) => {
                const message = event(function (e) {
                    callback(e);
                });
                return {
                    dispose: () => {
                        if (unsubMsg) {
                            this._send(unsubMsg);
                        }
                        message.dispose();
                    },
                };
            },
        };
    }
    public disconnect() {
        this._sender.disconnect();
        return this;
    }

    public connect() {
        this._sender.connect();
        return this;
    }

    public dispose() {
        this._sender.dispose();
        return this;
    }
}
