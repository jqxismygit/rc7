import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    profile: null,
    isEmployee: false,
    /** 是否具备 OPERATOR 角色（券码核销等），由 fetchProfile 与 setProfile 同步 */
    isOperator: false,
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
      if (profile && 'isOperator' in profile) {
        this.isOperator = !!profile.isOperator
      }
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
      this.isOperator = false
      this.invoiceTitle = ''
    }
  },
})
