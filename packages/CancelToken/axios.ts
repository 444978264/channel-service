import axios, {
    AxiosInstance,
    CancelTokenSource,
    AxiosRequestConfig,
} from 'axios';

interface IDispose {
    dispose(): void;
}

type ICancelToken = CancelTokenSource & IDispose;

class CancelTokenFactory implements IDispose {
    static NOOP = () => {};
    private _tokenMap = new Set<ICancelToken>();

    public create(): ICancelToken {
        const source = axios.CancelToken.source();
        let isDisposed = false;
        let isCanceled = false;
        const final = () => {
            this._tokenMap.delete(result);
            result.dispose = result.cancel = CancelTokenFactory.NOOP;
        };
        const result: ICancelToken = {
            token: source.token,
            cancel: (msg?: string) => {
                if (isCanceled || isDisposed) return;
                isCanceled = true;
                source.cancel(msg);
                final();
            },
            dispose() {
                if (isCanceled || isDisposed) return;
                isDisposed = true;
                final();
            },
        };
        this._tokenMap.add(result);
        return result;
    }

    public dispose() {
        if (this._tokenMap.size) {
            this._tokenMap.forEach(source => {
                source.cancel('dispose');
            });
        }
    }
}

interface IWithCancelToken {
    <T = any>(params: AxiosRequestConfig): Promise<T>;
}

class Core implements IDispose {
    public get = (
        url: string,
        params?: AxiosRequestConfig['params'],
        config?: AxiosRequestConfig,
    ) => {
        return this.withCancel(this._instance.request)({
            url,
            ...config,
            params,
            method: 'GET',
        });
    };

    public post = (
        url: string,
        data?: AxiosRequestConfig['data'],
        config?: AxiosRequestConfig,
    ) => {
        return this.withCancel(this._instance.request)({
            url,
            ...config,
            data,
            method: 'POST',
        });
    };

    constructor(
        private _instance: AxiosInstance,
        public readonly tokenFactory: CancelTokenFactory,
    ) {}

    private serialization = (url: string, param?: any) => {
        return param ? `${url}?${new URLSearchParams(param).toString()}` : url;
    };

    public withCancel(request: IWithCancelToken) {
        const {token, ...other} = this.tokenFactory.create();
        return function ({cancelToken, ...rest}: AxiosRequestConfig) {
            const promise = request({
                ...rest,
                cancelToken: token,
            });
            return {
                then: promise.then.bind(promise),
                finally: (callback?: () => any) => {
                    return promise.finally(() => {
                        callback && callback();
                        other.dispose();
                    });
                },
                catch: promise.catch.bind(promise),
                ...other,
            };
        };
    }

    public dispose() {
        this.tokenFactory.dispose();
    }
}

export const axiosInstance = new Core(axios.create(), new CancelTokenFactory());
