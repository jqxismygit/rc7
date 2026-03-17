import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    profile: null,
    isEmployee: false,
    invoiceTitle: ''
  }),
  getters: {
    isLoggedIn: (state) => !!state.token
  },
  actions: {
    setToken(token) {
      this.token = token || ''
    },
    setProfile(profile) {
      this.profile = profile || null
    },
    setIsEmployee(flag) {
      this.isEmployee = !!flag
    },
    setInvoiceTitle(title) {
      this.invoiceTitle = title || ''
    },
    logout() {
      this.token = ''
      this.profile = null
      this.isEmployee = false
      this.invoiceTitle = ''
    }
  },
})
