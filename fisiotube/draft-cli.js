#!/usr/bin/env node
'use strict';
// Explicit, manual scientific draft command. No video generation or publication.
const {searchPubMed,fetchPubMedArticles,createDraft}=require('./scientific-core');
async function main(){
 const query=process.argv.slice(2).join(' ').trim();
 if(!query){console.error('Usage: node fisiotube/draft-cli.js "TENS hypertension randomized trial"');process.exitCode=2;return;}
 const ids=await searchPubMed(query,{maxResults:5});
 const articles=await fetchPubMedArticles(ids);
 const draft=createDraft(query,articles);
 process.stdout.write(JSON.stringify(draft,null,2)+'\n');
}
if(require.main===module)main().catch(err=>{console.error('Scientific draft failed:',err.message);process.exitCode=1;});
module.exports={main};
