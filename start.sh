#!/bin/bash
# OpenCC - Tüm servisleri tek komutla başlat
set -e
cd "$(dirname "$0")"

echo "OpenCC başlatılıyor..."
docker compose up -d --build

echo ""
echo "Servisler başlatıldı. Hazır olması birkaç saniye sürebilir."
echo ""
echo "  Frontend:  https://localhost:3783"
echo "  Backend:   http://localhost:5001"
echo "  Giriş:     admin / admin123  (Ayarlar için admin gerekli)"
echo ""
echo "İlk kurulumda seed çalıştırın:"
echo "  docker compose exec backend npm run seed"
echo ""
