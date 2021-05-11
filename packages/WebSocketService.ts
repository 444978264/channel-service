import {Event, IDisposables} from '../utils/event';
import {Service} from './ServiceManager';

interface ISocketResponse<T> {
    subscribe(d: (c: T) => void): void;
}

export interface ISocketServiceConfig<T> {
    resultSelector?(e: any): T;
}

export class SocketService<T> extends Service {
    public onMessage = Event.from<T>(this._sender, 'message', d => {
        return (
            this._opt.resultSelector?.(d.data) || this.resultSelector(d.data)
        );
    });
    public onError = Event.from<T>(this._sender, 'error');
    private _onOpen = Event.from<T>(this._sender, 'open');
    private _onClose = Event.from<T>(this._sender, 'close');
    private disposables: IDisposables = new Set();
    private _onReadyHandle: (() => any)[] = [];
    constructor(
        private _sender: WebSocket,
        private _opt: ISocketServiceConfig<T> = {},
    ) {
        super();
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
            }),
        );
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
                return () => {
                    if (unsubMsg) {
                        this._send(unsubMsg);
                    }
                    message.dispose();
                };
            },
        };
    }

    dispose() {
        this._sender.close();
    }
}
