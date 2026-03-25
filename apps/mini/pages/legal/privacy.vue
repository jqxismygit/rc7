<template>
  <view class="legal-page"></view>
</template>

<script>
export default {
  name: 'LegalPrivacy',
  async onLoad() {
    uni.redirectTo({ url: '/pages/legal/legal-center?type=privacy' })
  }
}
</script>

<style lang="scss" scoped>
.legal-page {
  width: 100%;
  min-height: 100vh;
  background: $cr7-black;
}
</style>
