import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import { getSnapUpUrl, gotoUrl } from './util';

interface WindowExtends extends Window {
  _JdEid: string;
  _JdJrTdRiskFpInfo: string;
}

declare const $: any;
declare const window: WindowExtends;

const skuId = '100012043978';
/** 获取收货信息 */
async function getDeliveryInfo(page: puppeteer.Page, skuId: string): Promise<any> {
  page.evaluate((sku) => {
    $.post('https://marathon.jd.com/seckillnew/orderService/pc/init.action', {
      sku,
      num: 1,
      isModifyAddress: 'false'
    });
  }, skuId);
  return new Promise((resolve) => {
    const listener = async (response: puppeteer.Response) => {
      if (response.url().indexOf('https://marathon.jd.com/seckillnew/orderService/pc/init.action') >= 0) {
        page.off('response', listener);
        const data = JSON.parse(await response.text());
        resolve(data);
      }
    };
    page.on('response', listener);
  });
}

/** 获取eid和fp */
async function getJdParamsInfo(page: puppeteer.Page) {
  return await page.evaluate(() => {
    return {
      eid: window._JdEid,
      fp: window._JdJrTdRiskFpInfo
    }
  })
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
  const page = (await browser.pages())[0];
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36');

  await gotoUrl(page, 'https://item.jd.com/100012043978.html', {
    waitUntil: 'domcontentloaded'
  });
  await page.evaluate((skuId) => {
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
          if (res.url === '' && recount < 1000) {
            setTimeout(() => {
              request();
            }, 100);
          }
        }
      });
    };
    request();
  }, skuId);
  const targetUrl = await getSnapUpUrl(page);
  await gotoUrl(page, targetUrl);
  const deliveryData = await getDeliveryInfo(page, skuId);
  const jdParamsInfo = await getJdParamsInfo(page);
  fs.writeFileSync('init.action.json', JSON.stringify(deliveryData), { encoding: 'utf8' });
  console.log('已生成init.action.json');
  fs.writeFileSync('config.json', JSON.stringify(jdParamsInfo), { encoding: 'utf8' });
  console.log('已生成config.json');
})();