module.exports = {
  computeContentType: (filename) => {
    const parts = filename.split('.');
    console.log(filename.split('.')[parts.length - 1]);
    switch (filename.split('.')[parts.length - 1]) {
      case 'png':
        return "image/png";
      case 'gif':
        return "image/gif";
      case 'html':
        return "text/html";
      case 'js':
        return "application/javascript";
      case 'css':
        return "text/css";
      case 'sass':
        return "text/css";
      case 'svg':
        return "image/svg+xml";
    }
  }
}