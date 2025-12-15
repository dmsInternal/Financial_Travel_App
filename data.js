// data.js

window.CATEGORIES = [
  { id: 'FLIGHTS_INT', name: 'International Flights', color: '#42A5F5', icon: 'flight', type: 'expense' },
  { id: 'FLIGHTS_DOM', name: 'Domestic Flights', color: '#64B5F6', icon: 'flight', type: 'expense' },
  { id: 'TRANSPORT_LOCAL', name: 'Local Transport', color: '#FFB300', icon: 'directions_bus', type: 'expense' },
  { id: 'ACCOMMODATION', name: 'Accommodation', color: '#E57373', icon: 'hotel', type: 'expense' },
  { id: 'FOOD_DRINK', name: 'Food & Drink', color: '#FF8A65', icon: 'restaurant', type: 'expense' },
  { id: 'ATTRACTIONS', name: 'Attractions', color: '#BA68C8', icon: 'attractions', type: 'expense' },
  { id: 'SHOPPING', name: 'Shopping', color: '#4DD0E1', icon: 'shopping_bag', type: 'expense' },
  { id: 'COMMUNICATION', name: 'Communication', color: '#9575CD', icon: 'phone_iphone', type: 'expense' },
  { id: 'LAUNDRY', name: 'Laundry', color: '#90CAF9', icon: 'local_laundry_service', type: 'expense' },
  { id: 'HEALTH', name: 'Health', color: '#81C784', icon: 'health_and_safety', type: 'expense' },
  { id: 'VISAS_FEES', name: 'Visas & Fees', color: '#A1887F', icon: 'passport', type: 'expense' },
  { id: 'OTHER', name: 'Other / Misc', color: '#B0BEC5', icon: 'more_horiz', type: 'expense' },
  { id: 'BANK_FEES', name: 'Bank Fees', color: '#A1887F', icon: 'percent', type: 'expense' },
  { id: 'INSURANCE', name: 'Insurance', color: '#26A69A', icon: 'shield', type: 'expense' },
  { id: 'CASH_WITHDRAWAL', name: 'Cash Withdrawal', color: '#90A4AE', icon: 'account_balance_wallet', type: 'withdrawal' }
];

// Payment methods (show name, store ID)
// IMPORTANT: include only one Cash option (no Cash_XXX here).
window.PAYMENT_METHODS = [
  { id: 'BANK_MAIN_ILS', name: 'Main Bank Account (ILS)' },
  { id: 'BANK_MAIN_USD', name: 'Main Bank Account (USD)' },
  { id: 'BANK_SAV_ILS', name: 'Savings Bank Account (ILS)' },
  { id: 'CARD_ONE_ILS', name: 'Behatsdaa (ILS)' },
  { id: 'CARD_TWO_ILS', name: 'Muchiler (ILS)' },
  { id: 'CARD_THREE_ILS', name: 'Leumi (ILS)' },
  { id: 'CASH', name: 'Cash' }
];

// Locked currency list (drives dropdowns)
window.CURRENCIES = [
  { code: 'ILS', name: 'ILS' },
  { code: 'USD', name: 'USD' },
  { code: 'EUR', name: 'EUR' },
  { code: 'THB', name: 'THB' },
  { code: 'NPR', name: 'NPR' },
  { code: 'ARS', name: 'ARS' },
  { code: 'BRL', name: 'BRL' },
  { code: 'CLP', name: 'CLP' },
  { code: 'PEN', name: 'PEN' },
  { code: 'COP', name: 'COP' },
  { code: 'BOB', name: 'BOB' },
  { code: 'UYU', name: 'UYU' },
  { code: 'PYG', name: 'PYG' },
  { code: 'MXN', name: 'MXN' },
  { code: 'CRC', name: 'CRC' }
];

// Cash wallets for balances / withdrawals (received cash)
window.CASH_WALLETS = [
  { id: 'CASH_ILS', name: 'Cash ILS' },
  { id: 'CASH_USD', name: 'Cash USD' },
  { id: 'CASH_EUR', name: 'Cash EUR' },
  { id: 'CASH_THB', name: 'Cash THB' },
  { id: 'CASH_NPR', name: 'Cash NPR' },
  { id: 'CASH_ARS', name: 'Cash ARS' },
  { id: 'CASH_BRL', name: 'Cash BRL' },
  { id: 'CASH_CLP', name: 'Cash CLP' },
  { id: 'CASH_PEN', name: 'Cash PEN' },
  { id: 'CASH_COP', name: 'Cash COP' },
  { id: 'CASH_BOB', name: 'Cash BOB' },
  { id: 'CASH_UYU', name: 'Cash UYU' },
  { id: 'CASH_PYG', name: 'Cash PYG' },
  { id: 'CASH_MXN', name: 'Cash MXN' },
  { id: 'CASH_CRC', name: 'Cash CRC' }
];
