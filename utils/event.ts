export interface IDispose {
    dispose(): void;
}
export type Event<T = any> = (
    listener: (e: T) => any,
    thisArgs?: any,
    disposables?: any,
) => IDispose;
export interface ISender<T> {
    addEventListener(channel: string, listener: (e: T) => void): void;
    removeEventListener(channel: string, dispose: (e: T) => void): void;
}
export namespace Event {
    export function from<T>(
        sender: ISender<T>,
        channel: string,
        map: (...args: any[]) => T,
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
        debugger;
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
        debugger;
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
}

type IListener<T = any> = [(d: T) => void, any];
interface IEmitter {
    onFirstAdd?(): void;
    onLastRemove?(): void;
}
export class Emitter<T> implements IDispose {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private static readonly _noop = function () {};
    private _deliverQueue = new Set<IListener>();
    private _event: Event<T> | null = null;
    private _disposed = false;
    constructor(private options: IEmitter = {}) {}
    get event(): Event<T> {
        if (this._event === null) {
            this._event = (
                listener: (e: T) => any,
                thisArgs: any = undefined,
                disposables?: any,
            ) => {
                if (!this._deliverQueue.size) {
                    this.options.onFirstAdd?.();
                }

                const params: IListener = [listener, thisArgs];
                this._deliverQueue.add(params);

                const result = {
                    dispose: () => {
                        if (this._disposed) return;
                        result.dispose = Emitter._noop;
                        this._deliverQueue.delete(params);
                        if (!this._deliverQueue.size) {
                            this.options.onLastRemove?.();
                        }
                    },
                };
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
