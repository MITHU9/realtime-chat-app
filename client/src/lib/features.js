const fileFormat = (url) => {
  const fileExt = url.split(".").pop();

  //console.log("fileExt", fileExt);

  if (fileExt === "mp4" || fileExt === "webm" || fileExt === "ogg") {
    return "video";
  }
  if (fileExt === "mp3" || fileExt === "wav") {
    return "audio";
  }
  if (
    fileExt === "png" ||
    fileExt === "jpeg" ||
    fileExt === "jpg" ||
    fileExt === "gif"
  ) {
    return "image";
  }
  return "file";
};

const transformImage = (url = "", width = 100) => url;

export { fileFormat, transformImage };
