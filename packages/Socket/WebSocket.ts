import {EventEmitter} from '../../utils/event';
import {ReconnectTimeError} from './Error';

export enum SOCKET_STATUS {
    beforeSend = 'beforeSend',
    beforeMessage = 'beforeMessage',
    connect = 'connect',
    disconnect = 'disconnect',
    error = 'error',
    reconnect = 'reconnect',
    connecting = 'connecting',
    message = 'message',
}

export enum ADAPTER_STATUS {
    CONNECTING,
    OPEN,
    CLOSING,
    CLOSED,
}

type IAdapterEvent = 'message' | 'close' | 'error' | 'open';

interface IAdapter {
    addEventListener(type: IAdapterEvent, callback: (e: any) => void): void;
    removeEventListener(type: IAdapterEvent, callback: (e: any) => void): void;
    close(code?: number, reason?: string): void;
    readyState: ADAPTER_STATUS; // the same as WebSocket.readyState's value
    send(data: any): void;
}

export interface ISocketCoreConfig {
    autoReconnect?: boolean;
    autoConnect?: boolean;
    duration?: number;
    maxRetry?: number;
    resultSelector?(e: any): any;
    adapter?<T extends IAdapter>(url: string): T;
}

const DEFAULT_CONFIG = {
    autoReconnect: true,
    autoConnect: true,
    maxRetry: 5,
    duration: 3000,
    resultSelector(d: string) {
        return JSON.parse(d);
    },
};

export class SocketCore {
    public static SOCKET_STATUS = SOCKET_STATUS;
    static DESTROY_CODE = 1000;
    private _socket: IAdapter | null = null;
    public connected = false;
    public disconnected = true;
    private _config: ISocketCoreConfig;
    private _retryCount = 0;
    private _onReadyHandle: (() => any)[] = [];
    public readonly hooks = new EventEmitter<SOCKET_STATUS>();
    constructor(private _url: string, _config?: ISocketCoreConfig) {
        this._config = {
            ...DEFAULT_CONFIG,
            ..._config,
        };
        this.hooks.on(SOCKET_STATUS.connect, () => {
            this._retryCount = 0;
            this.connected = true;
            this.disconnected = !this.connected;
        });

        this.hooks.on(SOCKET_STATUS.disconnect, () => {
            this.connected = false;
            this.disconnected = !this.connected;
            this._dispose(this._socket);
            this._socket = null;
            if (this._config.autoReconnect) {
                setTimeout(() => {
                    this.hooks.emit(SOCKET_STATUS.reconnect);
                    this.connect();
                }, this._config.duration || DEFAULT_CONFIG.duration);
            }
        });

        this._config.autoConnect && this.connect();
    }

    private resultSelector(d: string) {
        return JSON.parse(d);
    }

    private _listen(instance: IAdapter) {
        instance.addEventListener('open', this._open);
        instance.addEventListener('message', this._message);
        instance.addEventListener('close', this._close);
        instance.addEventListener('error', this._error);
    }

    private _dispose(instance: IAdapter | null) {
        if (instance) {
            instance.removeEventListener('open', this._open);
            instance.removeEventListener('message', this._message);
            instance.removeEventListener('close', this._close);
            instance.removeEventListener('error', this._error);
        }
    }

    private _onReady(cbk: () => any) {
        if (this._socket?.readyState === ADAPTER_STATUS.OPEN) {
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
            this.connect();
            // throw Error(
            //     'make sure the websocket is connected, there is no websocket instance!',
            // );
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

    connect() {
        this._catchError(() => {
            const maxRetry = this._config.maxRetry ?? DEFAULT_CONFIG.maxRetry;
            if (this._socket === null && this._retryCount <= maxRetry) {
                this._socket =
                    this._config.adapter?.(this._url) ??
                    new WebSocket(this._url);
                this._listen(this._socket);
                this.hooks.emit(SOCKET_STATUS.connecting, ++this._retryCount);
            } else {
                throw new ReconnectTimeError(
                    'The number of retry connections has reached the limit，please check your network',
                );
            }
        });
        return this;
    }

    public disconnect() {
        if (this.connected && this._socket) {
            this._socket.close(SocketCore.DESTROY_CODE, '正常关闭');
        }
        return this;
    }

    public dispose() {
        this._dispose(this._socket);
        this.hooks.dispose();
        return this;
    }

    private _catchError(callback: (...args: any[]) => any) {
        try {
            callback();
        } catch (error) {
            this.hooks.emit(SOCKET_STATUS.error, error);
        }
    }
}
