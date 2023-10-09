class BSocialLike {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.txId = '';
      this.emoji = '';
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    setEmoji(emoji) {
      if (typeof emoji !== 'string' || !emoji.match(/\p{Emoji}/gu)) {
        throw new Error('Invalid emoji');
      }
      this.emoji = emoji;
    }
  
    getOps(format = 'hex') {
      if (!this.txId) throw new Error('Like is not referencing a valid transaction');
  
      const ops = [];
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push('like');
      ops.push('context');
      ops.push('tx');
      ops.push('tx');
      ops.push(this.txId);
  
      if (this.emoji) {
        ops.push('emoji');
        ops.push(this.emoji);
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}