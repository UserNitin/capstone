# Case Study: Network Traffic Analysis Using Graph Theory
**Marks: 10**

---

## 1. Problem Statement

Modern computer networks generate huge volumes of traffic every second. Traditional monitoring tools usually look at individual packets, flow counts, or simple thresholds (for example, “too many connections from one IP”). These methods often fail when:

- Attacks are **distributed** (DDoS, botnets) and no single host looks clearly malicious  
- Malicious activity is **low-and-slow** (slow scanning, stealthy lateral movement)  
- The volume of logs is so large that analysts cannot inspect every alert  

The core problem is that network communication is inherently **relational**: hosts interact with other hosts. Looking only at single machines misses the **structure** of communication. Without a model of “who talks to whom,” it is difficult to detect coordinated attacks, command-and-control (C2) patterns, or sudden changes in network behaviour.

**Therefore, the problem is:**  
*How can we analyse large-scale network traffic so that structural patterns and anomalies (attacks, scanners, botnets) are detected reliably, even when volume-based or signature-based methods fail?*

---

## 2. Objective

The objectives of this case study are:

1. To **model network traffic as a graph**, where nodes represent hosts (IP addresses) and edges represent communication (flows/connections).  
2. To apply **graph-theoretic measures** (degree, betweenness, clustering, graphlets, entropy) to understand normal vs abnormal traffic structure.  
3. To show how graph analysis can **detect anomalies** such as DDoS floods, scanning, and unusual communication communities.  
4. To propose a practical **solution pipeline** from data collection → graph construction → analysis → detection → response.  
5. To conclude with the **benefits and limitations** of using graph theory for network traffic analysis.

---

## 3. Data Collection

Relevant data for graph-based traffic analysis typically comes from network monitoring systems:

| Source | What it provides | Use in graph model |
|--------|------------------|--------------------|
| **NetFlow / IPFIX** | Source IP, destination IP, ports, protocol, bytes, packets, timestamps | Nodes = IPs; edges = flows |
| **Packet captures (PCAP)** | Full packet headers/payloads | Fine-grained edges and protocols |
| **Firewall / IDS logs** | Allowed/blocked connections, alerts | Labelled edges for validation |
| **DNS / proxy logs** | Domain lookups, web destinations | Extra node types (domains) |

**Recommended collection approach:**

1. Collect flow records in **fixed time windows** (e.g., every 30 seconds or 1–5 minutes).  
2. For each window, extract: `src_IP`, `dst_IP`, `protocol`, `bytes`, `packets`, `start_time`.  
3. Optionally enrich with: ASN, subnet, country, known-server tags.  
4. Clean data: remove malformed records, normalize private vs public IPs if needed.  
5. Store windowed graphs for time-series comparison (baseline vs current behaviour).

**Example edge record:**

```
Time Window: 10:00:00 – 10:00:30
Source: 192.168.1.10  →  Destination: 10.0.0.5
Protocol: TCP  |  Port: 443  |  Bytes: 15240  |  Packets: 28
```

This becomes an **edge** between two **nodes** in that window’s graph.

---

## 4. Analysis (Reason)

### 4.1 Why Graph Theory?

A network can be represented as:

\[
G = (V, E)
\]

- \(V\) = set of hosts (IP addresses)  
- \(E\) = set of communications (flows) between hosts  

Weights on edges can represent bytes, packets, or number of connections.

Graph theory is suitable because:

- Attacks change **topology**, not only volume (e.g., one victim suddenly connected to thousands of sources → star-like graph).  
- Botnets and C2 create unusual **communities** or hub-and-spoke patterns.  
- Centrality measures highlight **influential or suspicious** hosts without needing attack signatures.  
- Comparing graphs over time reveals **structural drift** (normal day vs attack day).

### 4.2 Key Graph Measures and Their Meaning

| Measure | Meaning in traffic | Typical anomaly signal |
|---------|--------------------|------------------------|
| **Degree centrality** | How many peers a host talks to | Sudden high degree → scanner / DDoS participant |
| **Betweenness centrality** | Hosts that lie on many paths | Unusual relays / compromised pivots |
| **Clustering coefficient** | How tightly neighbours interconnect | Drop or spike may indicate botnet formation |
| **Connected components / communities** | Groups of hosts communicating | New isolated attack communities |
| **Graphlets / motifs** | Small recurring subgraph patterns | Change in motif counts → behavioural anomaly |
| **Entropy of degree distribution** | Diversity of connectivity | Sharp entropy change during DDoS |

### 4.3 Reasoning with Attack Examples

1. **DDoS attack**  
   Many attacker nodes connect to one victim → high in-degree at the victim, star-shaped Traffic Dispersion Graph (TDG). Degree distribution becomes skewed; entropy of flows changes.

2. **Port / network scanning**  
   One source connects to many destinations/ports → high out-degree, sparse star from the scanner.

3. **Botnet C2**  
   Many bots talk to a few command servers → community structure with high-centrality C2 nodes.

4. **Lateral movement**  
   Unusual new edges between internal hosts that rarely communicate → new paths and rising betweenness for compromised hosts.

**Reason:** Volume thresholds alone may miss slow scans or blend into busy traffic; **structural change** in the communication graph is a stronger, signature-independent indicator.

---

## 5. Solution

### 5.1 Proposed Solution Pipeline

```
[NetFlow / Logs]
       ↓
[Time-window slicing]
       ↓
[Build graph G_t = (IPs, Flows)]
       ↓
[Compute graph features]
  - Degree / betweenness / clustering
  - Graphlet counts
  - Degree-distribution entropy
       ↓
[Compare with baseline (normal windows)]
       ↓
[Anomaly score / outlier detection]
       ↓
[Flag suspicious windows + IPs]
       ↓
[Analyst review / automated response]
```

### 5.2 Step-by-Step Method

**Step 1 – Graph construction**  
For each time window \(t\), build directed/undirected graph \(G_t\) from flow records. Edge weight = bytes or flow count.

**Step 2 – Feature extraction**  
Compute for each window and/or each node:

- Max degree, mean degree, degree distribution  
- Top-\(k\) central IPs  
- Graphlet / motif counts (local topology “fingerprint”)  
- Optionally Laplacian / spectral features for “heartbeat” of the network  

**Step 3 – Baseline learning**  
From known normal periods, learn typical ranges of these features (mean, variance, or clustering of feature vectors).

**Step 4 – Anomaly detection**  
Score new windows using:

- Statistical outliers (e.g., Mahalanobis distance on graphlet vectors — similar to GraphPrints)  
- Thresholds on centrality spikes  
- Change detection between consecutive graphs (e.g., difference in degree distribution)

**Step 5 – Localization**  
When a window is anomalous, rank IPs by change in degree/orbit/centrality to point analysts to likely attackers or victims.

**Step 6 – Response**  
Block or rate-limit flagged IPs, isolate hosts, or escalate to security operations (SOC).

### 5.3 Tools / Technologies (Practical)

- **Collection:** nProbe, Zeek, Wireshark, router NetFlow export  
- **Graph processing:** NetworkX (Python), Neo4j, Graph-tool  
- **Detection:** scikit-learn outlier models, custom centrality scripts  
- **Visualization:** Gephi, Cytoscape for attack topology views  

### 5.4 Expected Outcome

- Detect DDoS and scanning with high true-positive rate by spotting structural stars and degree spikes.  
- Reduce false alarms compared to pure volume alerts by requiring **graph-structure change**.  
- Give analysts a clear picture: which hosts became suddenly central, and how the attack graph looks.

---

## 6. Conclusion

Network traffic is fundamentally a set of relationships between hosts. Modelling it with **graph theory** turns raw flows into a structure that can be measured, compared, and visualized.

This case study shows that:

- The **problem** of detecting complex and stealthy attacks is better addressed by analysing communication structure, not only packet counts.  
- **Objectives** of modelling, measuring, and detecting anomalies can be met using centrality, communities, graphlets, and time-window comparison.  
- **Data collection** from NetFlow/PCAP provides the edges needed to build graphs.  
- **Analysis** explains why topology changes reveal DDoS, scans, and botnets.  
- The **solution** is a clear pipeline: windowed graphs → graph features → baseline comparison → IP-level alerts.

**Limitations:** Large graphs are computationally costly; encrypted traffic still yields useful metadata graphs but not payload detail; labelled attack data is needed to tune thresholds.

**Overall:** Graph theory provides a powerful, interpretable framework for network traffic analysis and is an effective complement to traditional signature-based and volume-based security monitoring.

---

### References (for further reading)

1. Bridges et al., *GraphPrints: Towards a Graph Analytic Method for Network Anomaly Detection* (arXiv:1602.01130).  
2. Traffic Dispersion Graph (TDG) based anomaly detection approaches.  
3. Network anomaly detection by IP flow graph analysis (DDoS case studies).  
4. Centrality measures (degree, betweenness, Laplacian) applied to cyber situational awareness.

---

**Word count guidance:** Suitable for a ~10-mark academic case study (concise, structured, exam-ready).
