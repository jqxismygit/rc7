import Request from '@/js_sdk/luch-request/luch-request/index.js'

const request = new Request();

request.setConfig((config) => {
	config.baseURL = import.meta.env.VITE_BASE_URL;
	return config;
});

// 获取公共请求头
const getCommonHeaders = () => {
	return {
		// "app-token": appData.token,
		// "app-coordinates": `${longitude},${latitude}`,
		// "app-channel": getAppChannel(),
		// "app-version": getAppVersion()
	};
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

    // //这里将返回值重新包装一下，包装成统一的数据结构
    // const res = {
    //     ...response.data
    // }
    // if (Array.isArray(res.data)) {
    //     res.data = {
    //         list: res.data,
    //         total: res.data.length
    //     }
    // }
    // // console.log('响应拦截器处理后的数据:', res)
    return res
}, (response) => { /*  对响应错误做点什么 （statusCode !== 200）*/
    // console.error('响应拦截器错误:', response)
    // if (response?.statusCode === 401) {
    //     console.log('响应状态码401，需要重新登录')
    //     uni.showToast({
    //         title: '登录过期，请重新登录',
    //         icon: 'none'
    //     })
    //     uni.navigateTo({
    //         url: '/pages/login/login'
    //     })
    // }
    return Promise.reject(response)
})


export default request;