// Public endpoint only; mail credentials stay in Firebase Secret Manager.
window.bookWebsiteContact = {
  enabled: true,
  endpoint: 'https://us-central1-hearttoheart-14e56.cloudfunctions.net/submitBookContact',
  allowLocalSending: true
};
