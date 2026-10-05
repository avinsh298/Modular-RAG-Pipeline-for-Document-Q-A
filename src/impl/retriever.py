import os
from typing import List
from dotenv import load_dotenv
import cohere

from src.interface.base_datastore import BaseDatastore
from src.interface.base_retriever import BaseRetriever

# Ensure .env is read
load_dotenv()


class Retriever(BaseRetriever):
    def __init__(self, datastore: BaseDatastore):
        self.datastore = datastore
        self.api_key = os.environ.get("CO_API_KEY") or os.environ.get("COHERE_API_KEY")

        # Initialize client once, or leave None if key is absent
        if self.api_key:
            self.co = cohere.ClientV2(api_key=self.api_key)
        else:
            self.co = None
            print("⚠️ CO_API_KEY not found. Retriever will fallback to raw vector search.")

    def search(self, query: str, top_k: int = 10) -> List[str]:
        # Fetch more candidates initially to give the reranker room to filter
        candidate_count = top_k * 3 if self.co else top_k
        search_results = self.datastore.search(query, top_k=candidate_count)

        if not search_results:
            return []

        # If Cohere client is active, rerank; otherwise return raw top_k
        if self.co:
            return self._rerank(query, search_results, top_k=top_k)

        return search_results[:top_k]

    def _rerank(
        self, query: str, search_results: List[str], top_k: int = 10
    ) -> List[str]:
        try:
            response = self.co.rerank(
                model="rerank-v3.5",
                query=query,
                documents=search_results,
                top_n=top_k,
            )

            result_indices = [result.index for result in response.results]
            print(f"✅ Reranked Indices: {result_indices}")
            return [search_results[i] for i in result_indices]

        except Exception as e:
            print(f"⚠️ Cohere reranking failed ({e}). Returning raw search results.")
            return search_results[:top_k]