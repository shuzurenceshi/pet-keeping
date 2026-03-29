#!/bin/bash

# 启动后端
cd /root/projects/myapp/pet-keeping/backend
npm install
npm run dev &

# 启动前端
cd /root/projects/myapp/pet-keeping/frontend
npm install
npm run dev &
