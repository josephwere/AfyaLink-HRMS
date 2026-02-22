# Deployment Configs

## Available Configs
- `nginx/afyalink.conf`: existing single-region baseline.
- `nginx/afyalink-multiregion.conf`: edge config for HAProxy-backed multi-region.
- `haproxy/haproxy.cfg`: existing baseline.
- `haproxy/haproxy-multiregion.cfg`: active/failover region routing template.
- `observability/prometheus.yml`: Prometheus scrape config for AfyaLink `/metrics`.
- `observability/grafana-dashboard-afyalink.json`: Grafana dashboard starter.
- `observability/alerts/afyalink-alert-rules.yml`: Prometheus alert rules.

## Usage
1. Start with single-region baseline.
2. Move to multi-region templates after readiness gates pass.
3. Update IPs, certificates, and DNS records before applying.
4. Set `METRICS_TOKEN` in backend and Prometheus to protect `/metrics` scraping.
