import 'dotenv/config';
import { embedText } from '../src/services/embedding.ts';

let testArr = await embedText('你好！');
console.log('[ test-embed ] >', testArr, testArr.length);
