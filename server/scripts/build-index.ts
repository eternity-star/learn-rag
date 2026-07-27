import 'dotenv/config';
import { Indexer } from '../src/services/indexer.ts';

const indexer = new Indexer();
await indexer.build();
indexer.save();
console.log('index built successfully');
