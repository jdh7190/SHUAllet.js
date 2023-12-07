# SHUAllet.js

![image](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANIAAAEEBAMAAACvp3f3AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAPUExURUdwTKNJpAAAAP/cT////7p6tDsAAAABdFJOUwBA5thmAAAA2klEQVR42u3aQQ6DIBBAUa7gFXqFXqH3P1NTFpoSaVCwyeD7W4d5O2MMKUmSJF3csxaJRLq7VN06nCORSGGlk09JJNLUUuuafo5EIpFIJBKJRCKRSCQSKS2f8oZlbW+kmCORSPNL+chjp21XwwiJRJpQqm4odjWMkEike0oNkUgkEolEIpW9viORSCQSiUQ69sXyGyGRSFNLra+kfoREIoWVTv4D6brzQSKRgkmHuC6ERCKFlRq4QQiJRAorVbnhCIlECisV3IUIiUQKK21c+kckEimiJEmSlHsD6x2hlxW3R3gAAAAASUVORK5CYII=)

## Introduction

SHUAllet.js is a simple browser wallet plug-in that supports common Bitcoin transaction functions.

The wallet has two private keys, one for payments (localStorage.walletKey), one for ownership of NFTs (localStorage.ownerKey).

## Setup

To use in your web application or site, simply include the scripts as follows:

```HTML
<html>
    <head>
        <script src="./scripts/bsv.browser.min.js"></script>
        <script src="./scripts/message.js"></script>
        <script src="./scripts/SHUAllet_plugin.js"></script>
    </head>
</html>
<script>
    
</script>
```

Note that bsv.browser.min.js and message.js are required, as SHUAllet.js is built atop of the [bsv legacy library 1.5.6](https://github.com/moneybutton/bsv/tree/bsv-legacy), and [Bitcoin Signed Messages](https://web.archive.org/web/20210516184640/https://docs.moneybutton.com/docs/bsv/bsv-message.html).

All JS files are combined in SHUAllet_plugin.js for easy, single JS file inclusion, but are isolated across other scripts logically for organization.

Inspect index.html to view the order in which script files should be included if done separately.

## Functions

SHUAllet.js supports commonly supported functions such as:

1 Sat Ordinals
- Inscribing
- Sending
- Listing
- Purchasing
- Canceling

BSocial
- Post
- Reply
- Like

Locks:
- Lock coins (with BSocial functions, Post, Like, Reply)
- Unlock coins
