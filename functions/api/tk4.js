export async function onRequest() {
  const destinationURL = "https://script.google.com/macros/s/AKfycbw8HoojYT17qeoBCryE1yYi4_W5ThpRx5KQPp3DgSN3sRinKjP3qi4uupZE8b0oA4qN/exec";
  return fetch(destinationURL);
}