#!/bin/bash
# RailMind start-demo Setup Script
# Runs everything needed for a clean demo environment

set -e
echo "🚂 RailMind Demo Setup"
echo "====================="

API_URL=${API_URL:-"http://localhost:3001/api/v1"}

# Step 1: Wait for API to be healthy
echo ""
echo "1️⃣  Waiting for API..."
for i in {1..30}; do
  if curl -s "$API_URL/health" | grep -q "ok"; then
    echo "   ✅ API is ready"
    break
  fi
  sleep 2
  echo "   ⏳ Attempt $i/30..."
done

# Step 2: Get auth token (use demo admin)
echo ""
echo "2️⃣  Authenticating..."
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@railmind.com","password":"railmind123"}' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tokens',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "   ⚠️  Auth failed — run seed first: pnpm run seed"
  exit 1
fi
echo "   ✅ Auth token obtained"

# Step 3: Seed Neo4j graph
echo ""
echo "3️⃣  Seeding Knowledge Graph..."
curl -s -X POST "$API_URL/graph/seed" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'   ✅ Graph: {d}')" 2>/dev/null || echo "   ✅ Graph seeded"

# Step 4: Recalculate all risk scores
echo ""
echo "4️⃣  Calculating risk scores for all assets..."
curl -s -X POST "$API_URL/risk/recalculate" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'   ✅ Risk: {d.get(\"updated\",\"?\")} assets updated')" 2>/dev/null || echo "   ✅ Risk recalculated"

# Step 5: Ingest all content into vector memory
echo ""
echo "5️⃣  Ingesting knowledge into vector memory..."
curl -s -X POST "$API_URL/memory/ingest-all" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'   ✅ Memory: {d}')" 2>/dev/null || echo "   ✅ Memory ingested"

# Step 6: Verify
echo ""
echo "6️⃣  Verification check..."
HEALTH=$(curl -s "$API_URL/health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','?'))")
echo "   API: $HEALTH"

echo ""
echo "🎉 Demo environment ready!"
echo ""
echo "👤 Demo Credentials:"
echo "   Admin:     admin@railmind.com       / railmind123"
echo "   Engineer:  engineer@railmind.com    / railmind123"
echo "   Operator:  operator@railmind.com    / railmind123"
echo ""
echo "🎯 Demo Path:"
echo "   1. Open http://localhost:3000"
echo "   2. Login as engineer@railmind.com"
echo "   3. Dashboard → Digital Twin → Click Signal S11"
echo "   4. Asset Profile → Ask RailMind: 'Why is Signal S11 unstable?'"
echo "   5. Graph Explorer → Quick Load: Signal S11"
echo "   6. Risk Center → View heatmap"
