class BSocialPost {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.type = 'post';
      this.txId = '';
  
      this.texts = [];
      this.images = [];
  
      this.extraMapData = {};
    }
  
    setType(type) {
      this.type = type;
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    addMapData(key, value) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Key and value should be a string');
      }
      this.extraMapData[key] = value;
    }
  
    addText(text, type = 'text/markdown') {
      if (typeof text !== 'string') throw new Error('Text should be a string');
  
      this.texts.push({
        text,
        type,
      });
    }
  
    addMarkdown(markdown) {
      this.addText(markdown);
    }
  
    addImage(dataUrl) {
      const image = dataUrl.split(',');
      const meta = image[0].split(';');
      const type = meta[0].split(':');
  
      if (type[0] !== 'data' || meta[1] !== 'base64' || !type[1].match('image/')) {
        throw new Error('Invalid image dataUrl format');
      }
  
      const img = atob(image[1]);
      this.images.push({
        content: img,
        type: type[1],
      });
    }
  
    getOps(format = 'hex') {
      // check for texts or images content
      const hasContent = this.texts.length > 0 || this.images.length > 0;
      const isRepost = this.type === 'repost' && this.txId;
      if (!hasContent && !isRepost) {
        throw new Error('There is no content for this post');
      }
  
      const ops = [];
  
      if (this.texts.length > 0) {
        this.texts.forEach((t) => {
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(t.text);
          ops.push(t.type);
          ops.push('UTF-8');
          ops.push('|');
        });
      }
  
      if (this.images.length > 0) {
        this.images.forEach((image) => {
          // image.content is in dataUrl format
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(image.content);
          ops.push(image.type);
          ops.push('|');
        });
      }
  
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push(this.type);
  
      if (this.txId) {
        // reply
        if (this.type !== 'repost') {
          // a repost does not need the context set
          ops.push('context');
          ops.push('tx');
        }
        ops.push('tx');
        ops.push(this.txId);
      }
  
      const extraMapData = Object.keys(this.extraMapData);
      if (extraMapData.length) {
        extraMapData.forEach((key) => {
          ops.push(key);
          ops.push(this.extraMapData[key]);
        });
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}