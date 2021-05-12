# channel-service

# How to use?

## in module

```
 require('channel-service')
```

or

```
import xx from 'channel-service'
```

## in browser

```
<script src="../dist/bundle.browser.js"></script>
<script>
    const socket = window.channelService.SocketService.create(
        'wss://fstream.binance.com/stream',
    );

    // socket
    //     .once(
    //         {method: 'SUBSCRIBE', params: ['!miniTicker@arr'], id: 2},
    //         d => d.id === '2',
    //     )
    //     .subscribe(function (res) {
    //         console.log(res, 'once');
    //     });

    socket
        .on({
            subMsg: {
                method: 'SUBSCRIBE',
                params: ['ltcusdt@kline_1d'],
                id: 1,
            },
            filter(d) {
                return d.stream === 'ltcusdt@kline_1d';
            },
            unsubMsg: {
                method: 'UNSUBSCRIBE',
                params: ['ltcusdt@kline_1d'],
                id: 4,
            },
        })
        .subscribe(function (d) {
            console.log(d, 'subscribe');
        });
</script>
```
