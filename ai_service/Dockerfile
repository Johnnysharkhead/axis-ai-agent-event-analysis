FROM ollama/ollama:latest

ARG MODEL_NAME=llama3.2:1b

# FIX: We added backslashes (\) before $! and $pid so Docker handles them correctly
RUN /bin/bash -c "ollama serve & pid=\$! && sleep 5 && ollama pull $MODEL_NAME && kill \$pid"

EXPOSE 11434