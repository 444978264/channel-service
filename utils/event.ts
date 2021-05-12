export interface IDispose {
    dispose(): void;
}

export type IDisposables = Set<IDispose>;

export type Event<T = any> = (
    listener: (e: T) => any,
    thisArgs?: any,
    disposables?: any,
) => IDispose;
export interface ISender<T = any> {
    addEventListener(channel: string, listener: (e: T) => void): void;
    removeEventListener(channel: string, dispose: (e: T) => void): void;
}
export namespace Event {
    export function from<T>(
        sender: ISender<T>,
        channel: string,
        map: (...args: any[]) => T = d => d,
    ): Event<T> {
        const listenFn = (...args: any[]) => emitter.fire(map(...args));
        const emitter = new Emitter<T>({
            onFirstAdd() {
                sender.addEventListener(channel, listenFn);
            },
            onLastRemove() {
                sender.removeEventListener(channel, listenFn);
            },
        });
        return emitter.event;
    }

    export function filter<T>(
        event: Event<T>,
        callback: (e: T) => boolean,
    ): Event<T> {
        return snapshot(
            (listener: (d: T) => IDispose, thisArgs = null, disposables?) => {
                return event(
                    function (e) {
                        callback(e) && listener.call(thisArgs, e);
                    },
                    thisArgs,
                    disposables,
                );
            },
        );
    }

    export function snapshot<T>(event: Event<T>): Event<T> {
        let listener: IDispose;
        const emitter = new Emitter<T>({
            onFirstAdd() {
                listener = event(emitter.fire, emitter);
            },
            onLastRemove() {
                listener.dispose();
            },
        });
        return emitter.event;
    }

    export function pickMap(data: any[] | Record<string, any>, key: string) {
        return key.split('.').reduce((v, k) => {
            return v && Reflect.has(v, k) ? Reflect.get(v, k) : undefined;
        }, data);
    }
}

type IListener<T = any> = [(d: T) => void, any];
interface IEmitter {
    onFirstAdd?(): void;
    onLastRemove?(): void;
}
export class Emitter<T> implements IDispose {
    static readonly NOOP = function () {};
    private _deliverQueue = new Set<IListener>();
    private _event: Event<T> | null = null;
    private _disposed = false;
    constructor(private options: IEmitter = {}) {}
    get event(): Event<T> {
        if (this._event === null) {
            this._event = (
                listener: (e: T) => any,
                thisArgs: any = undefined,
                disposables?: IDisposables,
            ) => {
                if (!this._deliverQueue.size) {
                    this.options.onFirstAdd?.();
                }

                const params: IListener = [listener, thisArgs];
                this._deliverQueue.add(params);

                const result = {
                    dispose: () => {
                        if (this._disposed) return;
                        result.dispose = Emitter.NOOP;
                        this._deliverQueue.delete(params);
                        if (disposables) {
                            disposables.delete(result);
                        }
                        if (!this._deliverQueue.size) {
                            this.options.onLastRemove?.();
                        }
                    },
                };

                if (disposables) {
                    disposables.add(result);
                }

                return result;
            };
        }
        return this._event;
    }
    public fire(event?: T): void {
        if (this._deliverQueue.size > 0) {
            this._deliverQueue.forEach(listener => {
                const [callback, thisObj] = listener;
                callback.call(thisObj, event);
            });
        }
    }

    public dispose(): void {
        if (!this._disposed) {
            this._disposed = true;
            this._deliverQueue.clear();
            this.options.onLastRemove?.();
        }
    }
}

export class EventEmitter<T extends string | number | symbol>
    implements IDispose {
    private _eventMap = {} as Record<T, Emitter<any>>;
    private _disposables = new Set<IDispose>();

    public on<R>(event: T, callback: (d?: R) => void): IDispose {
        if (!Reflect.has(this._eventMap, event)) {
            this._eventMap[event] = new Emitter({
                onLastRemove: () => {
                    Reflect.deleteProperty(this._eventMap, event);
                },
            });
        }
        return this._eventMap[event].event(callback, null, this._disposables);
    }

    public emit<R>(event: T, data?: R) {
        if (this._eventMap[event]) this._eventMap[event].fire(data);
    }

    public get(event: T): Emitter<any> {
        return this._eventMap[event];
    }

    public dispose() {
        if (this._disposables.size) {
            this._disposables.forEach(d => {
                d.dispose();
            });
        }
    }
}
