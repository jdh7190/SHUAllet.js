class BSocial {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
    }
  
    post() {
      return new BSocialPost(this.appName);
    }
  
    repost(txId) {
      const post = new BSocialPost(this.appName);
      post.setType('repost');
      post.setTxId(txId);
      return post;
    }
  
    reply(txId) {
      const post = new BSocialPost(this.appName);
      post.setTxId(txId);
      return post;
    }
  
    paywall(paywallMessage, paywallKey, paywallPayouts, paywallServer, paywallCurrency = 'USD') {
      // This will throw if the key is not valid
      const privateKey = bsv.PrivateKey.fromWIF(paywallKey);
  
      const post = new BSocialPost(this.appName);
      post.setPaywall(paywallMessage, privateKey, paywallPayouts, paywallServer, paywallCurrency);
  
      return post;
    }
  
    like(txId, emoji = '') {
      const like = new BSocialLike(this.appName);
      like.setTxId(txId);
      if (emoji) {
        like.setEmoji(emoji);
      }
  
      return like;
    }
  
    tip(txId, amount = 0, currency = 'USD') {
      const tip = new BSocialTip(this.appName);
      tip.setTxId(txId);
      if (amount && currency) {
        tip.setAmount(amount, currency);
      }
  
      return tip;
    }
  
    follow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      return follow;
    }
  
    unfollow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      follow.setAction('unfollow');
  
      return follow;
    }
}