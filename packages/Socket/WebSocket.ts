import {EventEmitter, Middleware} from '../../utils';
import {InterceptorError, ReconnectTimeError} from './Error';

export enum SOCKET_STATUS {
    connect = 'connect',
    disconnect = 'disconnect',
    error = 'error',
    reconnect = 'reconnect',
    connecting = 'connecting',
    message = 'message',
    interceptorError = 'interceptorError',
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

export interface IInterceptorMiddleware<T = any> {
    service: SocketCore;
    data: T;
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
    private _disposed = false;
    private _config: ISocketCoreConfig;
    private _retryCount = 0;
    private _onReadyHandle: (() => any)[] = [];
    public readonly hooks = new EventEmitter<SOCKET_STATUS>();

    public readonly interceptors = {
        request: new Middleware<IInterceptorMiddleware>(),
        response: new Middleware<IInterceptorMiddleware>(),
    };

    public get disconnected() {
        return !this.connected;
    }

    public get disposed() {
        return this._disposed;
    }

    constructor(private _url: string, _config?: ISocketCoreConfig) {
        this._config = {
            ...DEFAULT_CONFIG,
            ..._config,
        };
        this.registerHooks();
        this._config.autoConnect && this.connect();
    }

    public registerHooks() {
        this.hooks.on(SOCKET_STATUS.connect, () => {
            this._retryCount = 0;
            this.connected = true;
        });

        this.hooks.on(SOCKET_STATUS.disconnect, () => {
            this.connected = false;
            this._dispose();
            if (this._config.autoReconnect) {
                setTimeout(() => {
                    this.connect(true);
                }, this._config.duration || DEFAULT_CONFIG.duration);
            }
        });
        return this;
    }

    private _listen() {
        if (!this._socket) {
            this._socket =
                this._config.adapter?.(this._url) ?? new WebSocket(this._url);

            this.hooks.emit(SOCKET_STATUS.connecting);
            this._socket.addEventListener('open', this._open);
            this._socket.addEventListener('message', this._message);
            this._socket.addEventListener('close', this._close);
            this._socket.addEventListener('error', this._error);
        }
    }

    private _dispose() {
        if (this._socket) {
            this._socket.removeEventListener('open', this._open);
            this._socket.removeEventListener('message', this._message);
            this._socket.removeEventListener('close', this._close);
            this._socket.removeEventListener('error', this._error);
            this._socket = null;
        }
    }

    private _onReady(cbk: () => any) {
        if (this._socket?.readyState === ADAPTER_STATUS.OPEN) {
            return cbk();
        }
        this._onReadyHandle.push(cbk);
    }

    private _open = () => {
        this.hooks.emit(SOCKET_STATUS.connect);

        while (this._onReadyHandle.length) {
            const handle = this._onReadyHandle.shift();
            handle && handle();
        }
    };

    private _message = (e: MessageEvent) => {
        const context = this._context(e.data);
        this.interceptors.response.start(
            context,
            () => {
                this.hooks.emit(SOCKET_STATUS.message, context.data);
            },
            (ctx, reason) => {
                this.hooks.emit(
                    SOCKET_STATUS.interceptorError,
                    new InterceptorError(reason, ctx.data),
                );
            },
        );
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
                    writable: true,
                },
            },
        ) as IInterceptorMiddleware;
    }

    private _close = (e: CloseEvent) => {
        this.hooks.emit(SOCKET_STATUS.disconnect, e);
    };

    private _error = (e: Event) => {
        this.hooks.emit(SOCKET_STATUS.error, e);
    };

    public send(params: any) {
        this._onReady(() => {
            const context = this._context({...params});
            this.interceptors.request.start(
                context,
                () => {
                    this._socket?.send(context.data);
                },
                (ctx, reason = '') => {
                    this.hooks.emit(
                        SOCKET_STATUS.interceptorError,
                        new InterceptorError(reason, ctx.data),
                    );
                },
            );
        });
    }

    connect(isRetry?: boolean) {
        if (!this._socket) {
            this._catchError(() => {
                const maxRetry =
                    this._config.maxRetry ?? DEFAULT_CONFIG.maxRetry;

                if (isRetry) {
                    if (this._retryCount < maxRetry) {
                        this._retryCount++;
                        this.hooks.emit(
                            SOCKET_STATUS.reconnect,
                            this._retryCount,
                        );
                    } else {
                        throw new ReconnectTimeError(
                            'The number of retry connections has reached the limit，please check your network',
                        );
                    }
                }

                this._listen();
            });
        }

        return this;
    }

    public disconnect() {
        if (
            this._socket &&
            ![ADAPTER_STATUS.CLOSING, ADAPTER_STATUS.CLOSED].includes(
                this._socket.readyState,
            )
        ) {
            this._socket.close(SocketCore.DESTROY_CODE, 'close');
        } else {
            console.warn('Websocket is shutting down or has been shut down');
        }

        return this;
    }

    public dispose() {
        if (!this.disposed) {
            this._dispose();
            this.hooks.dispose();
            this._disposed = true;
        }
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
