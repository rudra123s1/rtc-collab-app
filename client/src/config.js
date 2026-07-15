// Global API configuration mapping local and production backend endpoints

export const getBackendUrl = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://happy-deer-walk.loca.lt';
};
