export async function onRequest() {
  const destinationURL = "https://script.google.com/macros/s/AKfycbxl2vmeyXEtNXXCsL__sAkOGJ7QqjAKLfUxlmz5h4eDZ4f8Jhs3R7PIg8jCHwUEcrS0Rg/exec";
  return fetch(destinationURL);
}