#!/usr/bin/env bash
set -e

COURSE_URL="https://www.udemy.com/course/llm-engineering-master-ai-and-large-language-models/learn/lecture/52932165#overview"
OUTPUT_DIR="output/AI-Engineer-Core-Track-LLM-Engineering,-RAG,-QLoRA,-Agents"

echo "Clearing previous output..."
rm -rf "$OUTPUT_DIR"

echo "Starting fresh extraction..."
npm run scrape -- "$COURSE_URL"
