import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

export const stockAPI = {
  // Get VN30 list
  getVN30List: async () => {
    const response = await axios.get(`${API_BASE_URL}/vn30-list`);
    return response.data;
  },

  // Get VN30 history
  getVN30History: async (days = 30) => {
    const response = await axios.get(
      `${API_BASE_URL}/vn30-history?days=${days}`
    );
    return response.data;
  },

  // Get single stock history
  getStockHistory: async (symbol, days = 30) => {
    const response = await axios.get(
      `${API_BASE_URL}/stock/${symbol}?days=${days}`
    );
    return response.data;
  },
};
