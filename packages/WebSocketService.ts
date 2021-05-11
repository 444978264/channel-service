import {Event, IDisposables, IDispose} from '../utils/event';
import {Service} from './ServiceManager';

interface ISocketResponse<T> {
    subscribe(d: (c: T) => void): IDispose;
}

export interface ISocketServiceConfig<T> {
    cache?: {namespace: string};
    autoReconnect?: boolean;
    resultSelector?(e: any): T;
}

export class SocketService<T> extends Service {
    public onMessage!: Event<T>;
    public onError!: Event<T>;
    private _onOpen!: Event<T>;
    private _onClose!: Event<T>;
    private disposables: IDisposables = new Set();
    private _onReadyHandle: (() => any)[] = [];
    constructor(
        private _sender: WebSocket,
        private _opt: ISocketServiceConfig<T> = {},
    ) {
        super();
        this._init();
        this.disposables.add(
            this._onOpen(() => {
                while (this._onReadyHandle.length) {
                    const handle = this._onReadyHandle.shift();
                    handle && handle();
                }
            }),
        );
        this.disposables.add(
            this._onClose(() => {
                this.disposables.forEach(d => {
                    d.dispose();
                });
                this.disposables.clear();
                if (this._opt.autoReconnect) {
                    this._sender = new WebSocket(this._sender.url);
                    // todo 解绑
                    this._init();
                }
            }),
        );
    }

    _init() {
        if (this._sender) {
            this.onMessage = Event.from<T>(this._sender, 'message', d => {
                return (
                    this._opt.resultSelector?.(d.data) ||
                    this.resultSelector(d.data)
                );
            });
            this.onError = Event.from<T>(this._sender, 'error');
            this._onOpen = Event.from<T>(this._sender, 'open');
            this._onClose = Event.from<T>(this._sender, 'close');
        }
    }

    private resultSelector(d: string) {
        return JSON.parse(d);
    }

    private _onReady(cbk: () => any) {
        if (this._sender.readyState === WebSocket.OPEN) {
            return cbk();
        }
        this._onReadyHandle.push(cbk);
    }

    call(name: string) {
        return Promise.resolve(name);
    }

    _send(params: any) {
        this._sender.send(JSON.stringify(params));
    }

    send(params: any): Event {
        this._onReady(() => this._send(params));
        return this.onMessage;
    }

    once<T>(params: any, filter?: (d: T) => boolean): ISocketResponse<T> {
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

    on<T>({
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
                            this._onReady(() => this._send(unsubMsg));
                        }
                        message.dispose();
                    },
                };
            },
        };
    }

    dispose() {
        this._sender.close();
    }
}
