import * as schedule from 'node-schedule';
import * as puppeteer from 'puppeteer';
import * as querystring from 'querystring';
import task from './task';
import { getSnapUpUrl, gotoUrl } from './util';
const { eid, fp } = require('../config');
const deliveryData = require('../init.action.json');

declare const $: any;
const customHtml = `
<!DOCTYPE html>
<html lang="zh-cmn-Hans">
  <head>
    <title>京东抢购</title>
    <meta charset="UTF-8">
  </head>
  <body>
    <span id="main"></span>
    <span id="sub"></span>
  </body>
</html>
`;


// 打开页面后等待预约或抢购的时间
function getWaitTime(fireDate: Date) {
  // 补上提前打开页面的一分钟时间
  const addTime = 60 * 1000;
  const startTime = fireDate.getTime();
  const now = Date.now();
  const scheduleTime = startTime + addTime;
  return scheduleTime - now;
}

// async function isLogin(page: puppeteer.Page): Promise<void> {
//   return new Promise((resolve) => {
//     const getNick = (data: string) => {
//       const start = data.indexOf('"nick":"') + 8;
//       const end = data.indexOf('","info"');
//       return data.slice(start, end);
//     };
//     const listener = async (response: puppeteer.Response) => {
//       if (response.url().indexOf('https://passport.jd.com/new/helloService.ashx') >= 0) {
//         page.off('response', listener);
//         const text = await response.text();
//         if (!getNick(text)) {
//           // eslint-disable-next-line no-console
//           console.log('当前状态未登录，请及时登录');
//           await page.evaluate(() => {
//             alert('当前状态未登录，请及时登录');
//           });
//         }
//         resolve();
//       }
//     };
//     page.on('response', listener);
//   });
// }

// async function getReservationInfo(page: puppeteer.Page): Promise<{ d: number; url: string }> {
//   return new Promise((resolve) => {
//     const listener = async (response: puppeteer.Response) => {
//       if (response.url().indexOf('https://yushou.jd.com/youshouinfo.action') >= 0) {
//         page.off('response', listener);
//         const text = await response.text();
//         resolve(parseJsonp(text));
//       }
//     };
//     page.on('response', listener);
//   });
// }

async function newPage(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36');

  return page;
}

function scheduleCronstyle(browser: puppeteer.Browser) {
  for (const key in task) {
    const item = task[key as keyof typeof task];
    schedule.scheduleJob(item.预约时间, async () => {
      const page = await newPage(browser);
      await gotoUrl(page, item.url);
      // const data = await getReservationInfo(page);
      // const waitTime = getWaitTime(fireDate);
      // console.log(key + '  waitTime', (waitTime) / 1000);
      // console.log(key + '  预约链接', data.url);
      // isLogin(page);
      
      // await page.waitFor(waitTime + 2000);
      // console.log(key +  '  localTime', new Date().getSeconds());
      // await gotoUrl(page, 'https:' + data.url);
      await page.waitFor('#btn-reservation');
      await page.click('#btn-reservation');
      // page.evaluate(() => {
      //   const go = () => {
      //     const anchor = document.querySelector('#btn-reservation') as HTMLAnchorElement;
      //     console.log(anchor.href);
          
      //     if (anchor.href) {
      //       anchor.click();
      //     } else {
      //       setTimeout(() => {
      //         go();
      //       }, 1000);
      //     }
      //   };
      //   go();
      // });
    });

    schedule.scheduleJob(item.抢购时间, async (fireDate) => {
      const page = await newPage(browser);
      await gotoUrl(page, item.url, {
        waitUntil: 'domcontentloaded'
      });
      const waitTime = getWaitTime(fireDate);
      await page.waitFor(waitTime - 500);
      page.evaluate((skuId) => {
        let recount = 0;
        const request = () => {
          $.ajax({
            url: 'https://itemko.jd.com/itemShowBtn',
            type: 'get',
            dataType: 'jsonp',
            data: {
              'skuId': skuId,
              'from': 'pc'
            },
            success: (res: any) => {
              if (res.url === '' && recount < 10000) {
                request();
              }
            }
          });
        };
        // 开启3个请求
        request();
        request();
        request();
      }, item.skuId);
      const targetUrl = await getSnapUpUrl(page);
      console.log(key + '  立即抢购链接', targetUrl);
      console.log(key + '  localTime', new Date());
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        const type = request.resourceType();
        if (request.url().indexOf('marathon.jd.com') >= 0 && (type === 'document')) {
          await request.respond({
            status: 200,
            contentType: 'text/html',
            body: customHtml
          });
        } else {
          await request.continue();
        }
      });
      page.on('domcontentloaded', () => {
        if (page.url().indexOf('https://marathon.jd.com') >= 0) {
          console.log(key + '  订单页面localTime', Date.now());
          const address = deliveryData.addressList[0];
          const invoice = deliveryData.invoiceInfo;
          const requestData = querystring.stringify({
            num: 1,
            yuShou: true,
            isModifyAddress: false,
            skuId: item.skuId,
            addressId: address.id,
            name: address.name,
            provinceId: address.provinceId,
            cityId: address.cityId,
            countyId: address.countyId,
            townId: address.townId,
            addressDetail: address.addressDetail,
            mobile: address.mobile,
            mobileKey: address.mobileKey,
            email: address.email,
            postCode: address.postCode,
            areaCode: address.areaCode,
            overseas: address.overseas,
            phone: address.phone,
            invoice: true,
            ...invoice,
            password: '',
            codTimeType: 3,
            paymentType: 4,
            eid,
            fp,
            token: deliveryData.token,
            pru: ''
          });
          page.evaluate((skuId, requestData, referrer) => {
            let recount = 0;
            const request = () => {
              fetch(`https://marathon.jd.com/seckillnew/orderService/pc/submitOrder.action?skuId=${skuId}`,{
                "credentials":"include",
                "headers":{
                  "accept": "application/json, text/plain, */*",
                  "accept-language":"zh-CN,zh;q=0.9",
                  "content-type": "application/x-www-form-urlencoded",
                  "sec-fetch-dest":"empty",
                  "sec-fetch-mode":"cors",
                  "sec-fetch-site":"same-origin"
                },
                "referrer": referrer,
                "referrerPolicy": "no-referrer-when-downgrade",
                "method":"POST",
                "mode":"cors",
                "body": requestData
              }).then((res) => res.text()).then((res) => {
                if (res.indexOf('"success":true') < 0) {
                  if (recount < 10) {
                    document.querySelector('#main')!.textContent = '正在抢购中...';
                    document.querySelector('#sub')!.textContent = `尝试次数${recount + 1}/10`;
                    setTimeout(() => {
                      recount++;
                      request();
                    }, 100);
                  }
                } else {
                  document.querySelector('#main')!.textContent = '抢购成功！';
                }
              });
            };
            // 开启3个请求
            request();
            request();
            request();
          }, item.skuId, requestData, targetUrl);
        }
      });
      await gotoUrl(page, targetUrl, {
        waitUntil: 'domcontentloaded'
      });
    });
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './cache',
    devtools: true,
    defaultViewport: {
      width: 1600,
      height: 1080
    }
  });
  // 获取第一个标签页
  const page = (await browser.pages())[0];
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36');
  await gotoUrl(page, 'https://home.jd.com');

  scheduleCronstyle(browser);
})();