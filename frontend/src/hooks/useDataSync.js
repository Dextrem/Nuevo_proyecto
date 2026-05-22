export const DATA_UPDATED_EVENT = 'financial-data-updated';

export const notifyDataUpdate = (type = 'all') => {
  localStorage.setItem('lastDataUpdate', Date.now().toString());
  window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: { type } }));
};

export const useDataSync = () => {
  return { notifyDataUpdate };
};
