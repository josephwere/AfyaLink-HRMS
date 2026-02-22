# Deployment Configs

## Available Configs
- `nginx/afyalink.conf`: existing single-region baseline.
- `nginx/afyalink-multiregion.conf`: edge config for HAProxy-backed multi-region.
- `haproxy/haproxy.cfg`: existing baseline.
- `haproxy/haproxy-multiregion.cfg`: active/failover region routing template.

## Usage
1. Start with single-region baseline.
2. Move to multi-region templates after readiness gates pass.
3. Update IPs, certificates, and DNS records before applying.
