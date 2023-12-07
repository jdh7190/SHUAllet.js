# SHUAllet.js

![image](https://v3.ordinals.gorillapool.io/content/d14b12a1e54eabc3ae9d15ef8e1f27c28f174fa27e01faacc04a29f98fe636b0_0)

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
