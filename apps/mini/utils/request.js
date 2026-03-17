import Request from '@/js_sdk/luch-request/luch-request/index.js'
import persistStorage from '@/utils/persistStorage.js'

const request = new Request();

request.setConfig((config) => {
	// 小程序端这里直接写死测试环境域名，避免 import.meta.env 在 mp 环境下为空
	config.baseURL = 'https://dev.cr7life.cn/api/';
	return config;
});

const getTokenFromPersistedUser = () => {
	const raw = persistStorage.getItem('user')
	if (!raw) return ''
	try {
		const state = typeof raw === 'string' ? JSON.parse(raw) : raw
		return state?.token || ''
	} catch (e) {
		return ''
	}
}

// 获取公共请求头
const getCommonHeaders = () => {
	const token = getTokenFromPersistedUser()
	return token
		? { "Authorization": `Bearer ${token}` }
		: {}
};

request.interceptors.request.use((config) => { // 可使用async await 做异步操作    
	// console.log('请求拦截器配置:', config)

	config.header = {
		...config.header,
		...getCommonHeaders()
	}
	console.log('请求拦截器处理后的配置:', config)

	return config
}, config => { // 可使用async await 做异步操作
	console.error('请求拦截器错误:', config)
	return Promise.reject(config)
})

request.interceptors.response.use((response) => { /* 对响应成功做点什么 可使用async await 做异步操作*/
    console.log('响应拦截器数据:', response)

    // 默认返回后端 data 字段，如果没有则返回原始响应
    const data = response?.data ?? response
    return data
}, (response) => { /*  对响应错误做点什么 （statusCode !== 200）*/
    // console.error('响应拦截器错误:', response)
    if (response?.statusCode === 401) {
        console.log('登录过期，需要重新登录')
        uni.showToast({
            title: '登录过期，请重新登录',
            icon: 'none'
        })
        uni.navigateTo({
            url: '/pages/login/login'
        })
    }
    return Promise.reject(response)
})


export default request;