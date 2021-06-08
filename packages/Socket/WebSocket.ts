import {EventEmitter, Middleware} from '../../utils';
import {ReconnectTimeError} from './Error';

export enum SOCKET_STATUS {
    beforeSend = 'beforeSend',
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
    adapter?<T extends IAdapter>(url: string): T;
}

const DEFAULT_CONFIG = {
    autoReconnect: true,
    autoConnect: true,
    maxRetry: 5,
    duration: 3000,
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
    public readonly interceptors = {
        request: new Middleware<{service: SocketCore; data: any}>(),
        response: new Middleware<{service: SocketCore; data: any}>(),
    };

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
                    this.connect(true);
                }, this._config.duration || DEFAULT_CONFIG.duration);
            }
        });

        this._config.autoConnect && this.connect();
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
        const context = this._context(e.data);
        this.interceptors.response.start(context, () => {
            this.hooks.emit(SOCKET_STATUS.message, context.data);
        });
    };

    private _context(value: any) {
        return Object.defineProperties(
            {},
            {
                service: {
                    value: this,
                    writable: false,
                    configurable: false,
                },
                data: {
                    value,
                    enumerable: true,
                },
            },
        );
    }

    private _close = (e: CloseEvent) => {
        this.hooks.emit(SOCKET_STATUS.disconnect, e);
    };

    private _error = (e: Event) => {
        this.hooks.emit(SOCKET_STATUS.error, e);
    };

    public send(params: any) {
        if (!this._socket) {
            this.connect();
        }
        this._onReady(() => {
            const context = this._context({...params});
            this.interceptors.request.start(context, () => {
                this._socket?.send(context.data);
            });
        });
    }

    connect(isRetry?: boolean) {
        this._catchError(() => {
            if (this._socket) return;

            const maxRetry = this._config.maxRetry ?? DEFAULT_CONFIG.maxRetry;

            if (isRetry) {
                if (this._retryCount < maxRetry) {
                    this._retryCount++;
                    this.hooks.emit(SOCKET_STATUS.reconnect, this._retryCount);
                } else {
                    throw new ReconnectTimeError(
                        'The number of retry connections has reached the limit，please check your network',
                    );
                }
            }

            this._socket =
                this._config.adapter?.(this._url) ?? new WebSocket(this._url);
            this._listen(this._socket);
            this.hooks.emit(SOCKET_STATUS.connecting);
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
