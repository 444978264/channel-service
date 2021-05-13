export type ICancelToken<T extends Record<string, any>> = {
    abort(message?: string): void;
    dispose(): void;
} & T;

export interface ICancelTokenConfig {
    createCancelToken<T>(): ICancelToken<T>;
}

export class CancelToken {
    static NOOP = () => {};
    private _cancelStack = new Set<ICancelToken<any>>();
    constructor(private _config: ICancelTokenConfig) {}
    createCancelToken<T>(): ICancelToken<T> {
        if (!Reflect.has(this._config, 'createCancelToken')) {
            throw Error(
                'you must set the config["createCancelToken"] to use withCancelToken function to create a cancel token !!',
            );
        }
        const cancelToken = this._config.createCancelToken<T>();

        this._cancelStack.add(cancelToken);

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const that = this;

        const result = {
            ...cancelToken,
            abort(message?: string) {
                cancelToken.abort(message);
                result.dispose();
            },
            dispose() {
                that._cancelStack.delete(cancelToken);
                result.abort = result.dispose = CancelToken.NOOP;
            },
        };

        return result;
    }

    getCancelTokens(): ICancelToken<any>[] {
        return [...this._cancelStack];
    }
}
