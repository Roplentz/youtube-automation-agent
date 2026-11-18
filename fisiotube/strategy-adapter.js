'use strict';
// Manual opt-in bridge to upstream ScriptWriterAgent strategy shape.
// This function never invokes the script writer, any AI provider or publishing.
const {searchPubMed,fetchPubMedArticles,createDraft}=require('./scientific-core');
async function prepareScientificStrategy({topic,query,maxResults=5,fetchImpl}={}){
 if(typeof topic!=='string'||!topic.trim()) throw Error('topic is required');
 const ids=await searchPubMed(query||topic,{maxResults,fetchImpl});
 const articles=await fetchPubMedArticles(ids,{fetchImpl});
 const draft=createDraft(topic,articles);
 const strategy={
   topic,contentType:'explainer',targetAudience:'Fisioterapeutas e estudantes',
   angle:'Discussão científica crítica, sem recomendações clínicas não verificadas',
   researchSources:articles.map(a=>({url:a.sourceUrl,title:a.title,pmid:a.pmid,doi:a.doi,abstract:a.abstract,sourceType:'peer_reviewed_index'})),
   channelConstraints:'Do not fabricate evidence, numerical results or clinical recommendations. Every claim requires human scientific review.',
   scientificReviewRequired:true,
   publishingEnabled:false
 };
 return {draft,strategy,articleCount:articles.length};
}
module.exports={prepareScientificStrategy};
