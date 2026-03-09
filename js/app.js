// Game State
let gameState = {
    currentLevel: 1,
    dataset: null,
    k: 3,
    algo: 'kmeans',
    rawData: [],
    elbowInertias: [],
    clusteredData: [],
    centroids: []
};

const API_BASE = "https://classification-backend-jdo1.onrender.com";

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const datasetLabel = document.getElementById('current-dataset-label');
const algoLabel = document.getElementById('current-algorithm-label');

const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];

document.addEventListener('DOMContentLoaded', () => {
    updateProgress();
    checkLibraries();
});

function checkLibraries() {
    if (typeof Chart === 'undefined' || typeof Plotly === 'undefined') {
        showNotification("Warning: Analysis libraries (Chart.js/Plotly) failed to load. Check your internet connection.", "error");
    } else {
        console.log("Analytics Engine Status: Online");
    }
}

function updateProgress() {
    const progress = (gameState.currentLevel / 6) * 100;
    document.getElementById('top-progress').style.width = `${progress}%`;
    
    navItems.forEach((item, idx) => {
        const level = idx + 1;
        item.classList.remove('active', 'completed');
        if (level === gameState.currentLevel) item.classList.add('active');
        if (level < gameState.currentLevel) item.classList.add('completed');
    });
}

function nextLevel() {
    if (gameState.currentLevel < 6) {
        document.getElementById(`level-${gameState.currentLevel}`).classList.remove('active');
        gameState.currentLevel++;
        document.getElementById(`level-${gameState.currentLevel}`).classList.add('active');
        updateProgress();
        
        // Increasing timeout to 800ms to ensure the browser finishes layout and CSS transforms
        // before any library (Plotly/Chart.js) tries to measure the container size.
        setTimeout(() => {
            console.log(`Current Level: ${gameState.currentLevel}`, gameState);
            if (gameState.currentLevel === 3) drawRaw3DChart();
            if (gameState.currentLevel === 4) drawElbowChart();
            if (gameState.currentLevel === 5) renderEmptyClusterChart();
            if (gameState.currentLevel === 6) renderInsights();
        }, 800);
    }
}

function updateAlgoLabel() {
    gameState.algo = document.getElementById('algo-select').value;
    algoLabel.textContent = gameState.algo === 'kmeans' ? 'K-Means' : 'DBSCAN';
    document.getElementById('proceed-insights').classList.add('hidden'); // Force re-run
}

async function selectDataset(name) {
    gameState.dataset = name;
    
    const labels = {
        'burnout': 'Burnout & Comp',
        'performance': 'Perf & Tenure',
        'culture': 'Culture Moons'
    };
    datasetLabel.textContent = labels[name];
    
    try {
        showNotification("Fetching Executive Data...", "info");
        const res = await fetch(`${API_BASE}/dataset/${name}`);
        const result = await res.json();
        
        gameState.rawData = result.data;
        gameState.elbowInertias = result.elbow;
        
        // Auto advance to 3D Viewer
        nextLevel();
    } catch (e) {
        showNotification("Error connecting to AI Server.", "error");
    }
}

function getAxisLabels() {
    if (gameState.dataset === 'burnout') return ['Hours Worked', 'Satisfaction', 'Salary ($)'];
    if (gameState.dataset === 'performance') return ['Tenure (Yrs)', 'Performance (1-5)', 'Commute (Mi)'];
    return ['Empathy Score', 'Ambition Score', 'Age'];
}

/* ------------------- LEVEL 3: 3D RAW DATA (PLOTLY) ------------------- */
function drawRaw3DChart() {
    const axes = getAxisLabels();
    
    const trace = {
        name: 'Employee Record',
        x: gameState.rawData.map(d => d.x),
        y: gameState.rawData.map(d => d.y),
        z: gameState.rawData.map(d => d.z),
        mode: 'markers',
        marker: { 
            size: 5, 
            color: '#3b82f6', 
            opacity: 0.7,
            line: { color: 'white', width: 0.5 }
        },
        type: 'scatter3d'
    };
    
    const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: { title: { text: axes[0], font: { size: 11, family: 'Outfit' } }, gridcolor: '#e2e8f0' },
            yaxis: { title: { text: axes[1], font: { size: 11, family: 'Outfit' } }, gridcolor: '#e2e8f0' },
            zaxis: { title: { text: axes[2], font: { size: 11, family: 'Outfit' } }, gridcolor: '#e2e8f0' },
            camera: { eye: { x: 1.8, y: 1.8, z: 1.2 } }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };
    Plotly.purge('plotlyRaw');
    Plotly.newPlot('plotlyRaw', [trace], layout, {displayModeBar: false});
}

/* ------------------- LEVEL 4: THE ELBOW METHOD (CHART.JS) ------------------- */
function drawElbowChart() {
    const ctx = document.getElementById('elbowChart').getContext('2d');
    
    // Check if Chart already exists and destroy
    if(window.elbowChartObj) window.elbowChartObj.destroy();
    
    window.elbowChartObj = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            datasets: [{
                label: 'Inertia (Error Rate)',
                data: gameState.elbowInertias,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#2563eb',
                pointRadius: 6,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Number of Clusters (K)' } },
                y: { 
                    title: { display: true, text: 'Inertia (Geometric Dispersion)' },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { 
                    callbacks: { 
                        label: function(ctx) { return `Error: ${Math.round(ctx.raw)}`; } 
                    } 
                }
            }
        }
    });
    
    // Force a redraw after a tick to handle hidden-to-visible transitions
    setTimeout(() => { 
        if(window.elbowChartObj) window.elbowChartObj.update(); 
    }, 100);
}

function setK(val) {
    gameState.k = val;
    document.querySelectorAll('.k-btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    event.target.classList.remove('btn-outline');
    event.target.classList.add('btn-primary');
}

/* ------------------- LEVEL 5: ALGORITHM EXECUTION (PLOTLY) ------------------- */
function renderEmptyClusterChart() {
    // Just show raw data again until they click run
    const axes = getAxisLabels();
    const trace = {
        name: 'Unclustered Data',
        x: gameState.rawData.map(d => d.x),
        y: gameState.rawData.map(d => d.y),
        z: gameState.rawData.map(d => d.z),
        mode: 'markers',
        marker: { size: 4, color: '#cbd5e1' },
        type: 'scatter3d'
    };
    const layout = { margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { xaxis: {title:axes[0]}, yaxis: {title:axes[1]}, zaxis: {title:axes[2]} } };
    
    // Use newPlot instead of react for complete dataset refreshes in WebGL
    Plotly.purge('plotlyCluster');
    Plotly.newPlot('plotlyCluster', [trace], layout, {displayModeBar: false});
}

async function runClustering() {
    const btn = document.getElementById('btn-run-clustering');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing Math...';
    btn.disabled = true;

    try {
        const payload = { dataset: gameState.dataset, k: gameState.k, algorithm: gameState.algo };
        
        const res = await fetch(`${API_BASE}/cluster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        gameState.clusteredData = result.data;
        gameState.centroids = result.centroids;

        // Group data by cluster for Plotly
        const traces = [];
        const uniqueClusters = [...new Set(gameState.clusteredData.map(d => d.cluster))];
        
        uniqueClusters.forEach(cId => {
            const pts = gameState.clusteredData.filter(d => d.cluster === cId);
            const color = cId === -1 ? '#000000' : colors[cId % colors.length]; // -1 is noise in DBSCAN
            const name = cId === -1 ? 'Noise/Outliers' : `Segment ${cId+1}`;
            
            traces.push({
                name: name,
                x: pts.map(p => p.x),
                y: pts.map(p => p.y),
                z: pts.map(p => p.z),
                mode: 'markers',
                marker: { size: 5, color: color, opacity: 0.9 },
                type: 'scatter3d'
            });
        });

        // Add Centroids
        if(gameState.centroids.length > 0 && gameState.algo === 'kmeans') {
            traces.push({
                name: 'Cluster Centers',
                x: gameState.centroids.map(c => c[0]),
                y: gameState.centroids.map(c => c[1]),
                z: gameState.centroids.map(c => c[2]),
                mode: 'markers',
                marker: { size: 12, color: '#0f172a', symbol: 'diamond', line: {color:'white', width:2} },
                type: 'scatter3d'
            });
        }

        const axes = getAxisLabels();
        const layout = { 
            margin: { l: 0, r: 0, b: 0, t: 0 }, 
            scene: { 
                xaxis: { title: { text: axes[0], font: {family: 'Outfit'}} }, 
                yaxis: { title: { text: axes[1], font: {family: 'Outfit'}} }, 
                zaxis: { title: { text: axes[2], font: {family: 'Outfit'}} },
                camera: { eye: { x: 1.5, y: 1.5, z: 1 } },
                gridcolor: '#e2e8f0'
            },
            legend: { 
                orientation: 'h', 
                x: 0.5, xanchor: 'center', 
                y: 1.1,
                font: { family: 'Plus Jakarta Sans', size: 10 }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        };
        
        const container = document.getElementById('plotlyCluster');
        Plotly.purge(container);
        
        // Ensure data exists
        if (traces.length === 0) {
            showNotification("No segments found by algorithm.", "error");
            return;
        }

        setTimeout(() => {
            Plotly.newPlot(container, traces, layout, {responsive: true, displayModeBar: false});
            setTimeout(() => { Plotly.Plots.resize(container); }, 200);
        }, 100);

        document.getElementById('proceed-insights').classList.remove('hidden');
        showNotification("Algorithm optimization complete.", "success");
        btn.innerHTML = '<i class="fas fa-check"></i> Re-Run Algorithm';
        btn.disabled = false;

    } catch(e) {
        showNotification("Algorithm Execution Failed. Check Terminal.", "error");
        btn.innerHTML = '<i class="fas fa-times"></i> Error';
        btn.disabled = false;
        console.error(e);
    }
}

/* ------------------- LEVEL 6: ROI & ETHICS ------------------- */
function renderInsights() {
    const container = document.getElementById('insights-container');
    container.innerHTML = '';
    
    // If DBScan on Culture, show special success card
    if(gameState.dataset === 'culture' && gameState.algo === 'dbscan') {
        container.innerHTML = `
            <div class="insight-card c1" style="grid-column: 1 / -1;">
                <h3><i class="fas fa-trophy"></i> DBSCAN Succeeded!</h3>
                <p>Because the "moons" dataset wraps around itself in concentric circles, K-Means failed to separate them (it looks for spheres). DBSCAN looks for density paths, successfully traversing the moon shapes!</p>
                <div class="roi-tag"><i class="fas fa-chart-line"></i> Technical Win: Model Accuracy Improved by 45%</div>
            </div>`;
    } else if (gameState.dataset === 'culture' && gameState.algo === 'kmeans') {
        container.innerHTML = `
            <div class="insight-card c0" style="grid-column: 1 / -1;">
                <h3><i class="fas fa-exclamation-triangle"></i> K-Means Failed to Segment</h3>
                <p>Did you notice the clusters cut straight through the middle of the "moons"? This is a classic case where Executive logic fails if you choose the wrong algorithm. K-Means assumes groups are circular. <strong>Go back to Step 5 and try DBSCAN.</strong></p>
                <button class="btn btn-outline mt-4" onclick="gameState.currentLevel = 4; nextLevel();">Go Back to Step 5</button>
            </div>`;
        return;
    }

    const uniqueClusters = [...new Set(gameState.clusteredData.map(d => d.cluster))].filter(c => c !== -1);
    
    uniqueClusters.forEach(c => {
        const clusterData = gameState.clusteredData.filter(d => d.cluster === c);
        const count = clusterData.length;
        
        // Calculate averges
        const avgX = clusterData.reduce((sum, d) => sum + d.x, 0) / count;
        const avgY = clusterData.reduce((sum, d) => sum + d.y, 0) / count;
        const avgZ = clusterData.reduce((sum, d) => sum + d.z, 0) / count;
        
        // Calculate Ethics Bias (percentage of bias flags)
        const biasCount = clusterData.reduce((sum, d) => sum + d.bias, 0);
        const biasPercent = Math.round((biasCount / count) * 100);

        let title = `Segment ${c+1}`;
        let description = "";
        let roiText = "";
        let ethicsWarning = "";

        // Insight Logic
        if (gameState.dataset === 'burnout') {
            if (avgX > 200 && avgY < 0.4) {
                title = "High Flight Risk (Overworked)";
                description = `Avg Hours: ${Math.round(avgX)}, Satisfaction: ${avgY.toFixed(2)}, Salary: $${Math.round(avgZ).toLocaleString()}`;
                roiText = `ROI: Retaining 20% saves $${(count * 0.2 * 30000).toLocaleString()} in recruitment costs.`;
            } else if (avgX < 150 && avgY < 0.6) {
                title = "Disengaged / Coasting";
                description = `Avg Hours: ${Math.round(avgX)}, Satisfaction: ${avgY.toFixed(2)}, Salary: $${Math.round(avgZ).toLocaleString()}`;
                roiText = `ROI: Upskilling increases productivity value by $${(count * 15000).toLocaleString()}.`;
            } else {
                title = "Optimal Producers";
                description = `Avg Hours: ${Math.round(avgX)}, Satisfaction: ${avgY.toFixed(2)}, Salary: $${Math.round(avgZ).toLocaleString()}`;
                roiText = `ROI: Target for leadership pipeline. High yield.`;
            }
            
            if (biasPercent > 70) {
                ethicsWarning = `
                    <div class="ethics-warning">
                        <h4><i class="fas fa-balance-scale-right"></i> Compliance Warning</h4>
                        <p>AI Bias detected. ${biasPercent}% of this cluster recently took Parental Leave. Taking punitive action on this group based on algorithmic output violates HR discrimination laws.</p>
                    </div>`;
            }
        } 
        else if (gameState.dataset === 'performance') {
             if (avgX > 4 && avgY > 3.5) {
                title = "Core Veterans";
                description = `Tenure: ${avgX.toFixed(1)}yrs, Perf: ${avgY.toFixed(1)}/5, Commute: ${Math.round(avgZ)}mi`;
                roiText = `ROI: Invest in retention. Key contributors.`;
             } else if (avgX > 5 && avgY < 2.5) {
                title = "Stagnant Veterans";
                description = `Tenure: ${avgX.toFixed(1)}yrs, Low Perf: ${avgY.toFixed(1)}/5, Long Commute: ${Math.round(avgZ)}mi`;
                roiText = `ROI: Reassignment/PIPs save $${(count * 40000).toLocaleString()} in misallocated compensation.`;
             } else {
                 title = "New Trainees";
                 description = `Tenure: ${avgX.toFixed(1)}yrs, Perf: ${avgY.toFixed(1)}/5, Commute: ${Math.round(avgZ)}mi`;
                 roiText = `ROI: Buddy program reduces 1st-year churn by 15%.`;
             }
             
             if (biasPercent > 70) {
                ethicsWarning = `
                    <div class="ethics-warning">
                        <h4><i class="fas fa-balance-scale-right"></i> Equal Opportunity Risk</h4>
                        <p>${biasPercent}% of employees in this low-performance cluster are aged 50+. Using this model unconditionally risks Age Discrimination lawsuits.</p>
                    </div>`;
            }
        }

        const cardElement = document.createElement('div');
        cardElement.className = `insight-card c${c}`;
        cardElement.innerHTML = `
            <h3><i class="fas fa-users-cog"></i> ${title}</h3>
            <p><strong>Profile:</strong> ${description}</p>
            <p style="color:#64748b; font-size:0.85rem; margin-bottom:1rem;">Headcount: ${count} employees</p>
            <div class="roi-tag"><i class="fas fa-coins"></i> ${roiText}</div>
            ${ethicsWarning}
        `;
        container.appendChild(cardElement);
    });
}

// Notifications
function showNotification(msg, type) {
    const container = document.getElementById('notification-container');
    const note = document.createElement('div');
    note.style.cssText = `
        background: ${type === 'error'? '#fee2e2' : 'white'}; 
        color: ${type === 'error'? '#991b1b' : '#1e293b'};
        padding: 1rem 2rem; border-radius: 8px; font-weight: 600;
        box-shadow: var(--shadow-lg); margin-bottom: 1rem;
        border-left: 5px solid ${type === 'error' ? 'red' : '#2563eb'};
        animation: fadeIn 0.3s ease;
    `;
    note.innerHTML = `<i class="fas ${type==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i>  ${msg}`;
    container.appendChild(note);
    setTimeout(() => note.remove(), 4000);
}
