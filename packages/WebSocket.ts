/**
 * Created by cyf on 2020-07-08.
 * 创建 websocket
 */

import {EventEmitter} from '../utils/event';

export enum SOCKET_STATUS {
    beforeSend,
    beforeMessage,
    connect,
    disconnect,
    error,
    reconnect,
    connecting,
    message,
}

export interface ISocketCoreConfig {
    autoReconnect?: boolean;
    autoConnect?: boolean;
    resultSelector?(e: any): any;
}

export class SocketCore {
    public static SOCKET_STATUS = SOCKET_STATUS;
    private _socket: WebSocket | null = null;
    public connected = false;
    public disconnected = true;
    private _onReadyHandle: (() => any)[] = [];
    static DESTROY_CODE = 1000;
    public readonly hooks = new EventEmitter<SOCKET_STATUS>();
    constructor(private _url: string, private _config: ISocketCoreConfig = {}) {
        this.hooks.on(SOCKET_STATUS.connect, () => {
            this.connected = true;
            this.disconnected = !this.connected;
        });

        this.hooks.on(SOCKET_STATUS.disconnect, () => {
            this.connected = false;
            this.disconnected = !this.connected;
            this._dispose(this._socket);
            this._socket = null;
        });

        if (this._config.autoConnect) {
            this.connect();
        }
    }
    private resultSelector(d: string) {
        return JSON.parse(d);
    }
    connect() {
        if (this._socket === null) {
            this._socket = new WebSocket(this._url);
            this._listen(this._socket);
            this.hooks.emit(SOCKET_STATUS.connecting);
        }
        return this;
    }

    public destroy() {
        if (this.connected && this._socket) {
            this._socket.close(SocketCore.DESTROY_CODE, '正常关闭');
        }
    }

    private _listen(instance: WebSocket) {
        instance.addEventListener('open', this._open);
        instance.addEventListener('message', this._message);
        instance.addEventListener('close', this._close);
        instance.addEventListener('error', this._error);
    }

    private _dispose(instance: WebSocket | null) {
        if (instance) {
            instance.removeEventListener('open', this._open);
            instance.removeEventListener('message', this._message);
            instance.removeEventListener('close', this._close);
            instance.removeEventListener('error', this._error);
        }
    }

    private _onReady(cbk: () => any) {
        if (this._socket?.readyState === WebSocket.OPEN) {
            return cbk();
        }
        this._onReadyHandle.push(cbk);
    }

    private _open = () => {
        while (this._onReadyHandle.length) {
            const handle = this._onReadyHandle.shift();
            handle && handle();
        }
        this.hooks.emit(SOCKET_STATUS.connect);
    };

    private _message = (e: MessageEvent) => {
        const data =
            this._config.resultSelector?.(e.data) ||
            this.resultSelector(e.data);
        if (this.hooks.get(SOCKET_STATUS.beforeMessage)) {
            this.hooks.emit(SOCKET_STATUS.beforeMessage, {
                data,
                next: this.hooks.emit.bind(
                    this.hooks,
                    SOCKET_STATUS.message,
                    data,
                ),
            });
        } else {
            this.hooks.emit(SOCKET_STATUS.message, data);
        }
    };

    private _close = (e: CloseEvent) => {
        this.hooks.emit(SOCKET_STATUS.disconnect, e);
    };

    private _error = (e: Event) => {
        this.hooks.emit(SOCKET_STATUS.error, e);
    };

    public send(params: any) {
        if (!this._socket) {
            throw Error(
                'make sure the websocket is connected, there is no websocket instance!',
            );
        }
        this._onReady(() => {
            if (this.hooks.get(SOCKET_STATUS.beforeSend)) {
                const res = {...params};
                this.hooks.emit(SOCKET_STATUS.beforeSend, {
                    data: res,
                    next: (d = res) => this._socket?.send(d),
                });
            } else {
                this._socket?.send(params);
            }
        });
    }
}
