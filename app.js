class App {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.filters = {
            platform: '',
            genre: '',
            yearRange: [1980, 2020],
            salesRange: [0, 100]
        };
        this.sliders = {};
        this.charts = {};
        this.currentPage = 1;
        this.itemsPerPage = 10;
    }

    async init() {
        try {
            this.showLoading('Iniciando...');
            await this.loadData();
            this.setupFilters();
            this.applyFilters();
            this.updateCharts();
            this.setupEventListeners();
            this.hideLoading();
        } catch (error) {
            console.error('Error initializing:', error);
            this.showError('Error al iniciar: ' + error.message);
            this.hideLoading();
        }
    }

    async loadData() {
        return new Promise((resolve, reject) => {
            if (typeof Papa === 'undefined') {
                reject(new Error('Papa Parse no disponible'));
                return;
            }
            Papa.parse(CONFIG.dataUrl, {
                download: true,
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                    if (results.errors.length) {
                        reject(new Error('Error al procesar CSV'));
                        return;
                    }
                    this.data = results.data
                        .filter(row => row.Name && row.Platform && row.Year && row.Genre)
                        .map(row => ({
                            ...row,
                            Year: parseInt(row.Year) || 0,
                            Global_Sales: parseFloat(row.Global_Sales) || 0,
                            NA_Sales: parseFloat(row.NA_Sales) || 0,
                            EU_Sales: parseFloat(row.EU_Sales) || 0,
                            JP_Sales: parseFloat(row.JP_Sales) || 0,
                            Other_Sales: parseFloat(row.Other_Sales) || 0
                        }));
                    resolve();
                },
                error: (error) => reject(error)
            });
        });
    }

    setupFilters() {
        this.populateDropdown('platformFilter', [...new Set(this.data.map(item => item.Platform))].sort());
        this.populateDropdown('genreFilter', [...new Set(this.data.map(item => item.Genre))].sort());

        const yearRange = this.getValueRange('Year');
        this.filters.yearRange = [yearRange.min, yearRange.max];
        const yearSlider = document.getElementById('yearSlider');
        if (yearSlider) {
            this.sliders.year = noUiSlider.create(yearSlider, {
                start: [yearRange.min, yearRange.max],
                connect: true,
                step: 1,
                range: { 'min': yearRange.min, 'max': yearRange.max },
                format: { to: value => Math.round(value), from: value => Number(value) },
                tooltips: true
            });
            this.sliders.year.on('update', (values) => {
                document.getElementById('yearRangeMin').textContent = values[0];
                document.getElementById('yearRangeMax').textContent = values[1];
            });
            this.sliders.year.on('change', (values) => {
                this.filters.yearRange = values.map(Number);
                this.applyFilters();
            });
        }

        const salesRange = this.getValueRange('Global_Sales');
        this.filters.salesRange = [0, Math.ceil(salesRange.max)];
        const salesSlider = document.getElementById('salesSlider');
        if (salesSlider) {
            this.sliders.sales = noUiSlider.create(salesSlider, {
                start: [0, Math.ceil(salesRange.max)],
                connect: true,
                step: 1,
                range: { 'min': 0, 'max': Math.ceil(salesRange.max) },
                format: { to: value => Math.round(value), from: value => Number(value) },
                tooltips: true
            });
            this.sliders.sales.on('update', (values) => {
                document.getElementById('salesRangeMin').textContent = values[0];
                document.getElementById('salesRangeMax').textContent = values[1];
            });
            this.sliders.sales.on('change', (values) => {
                this.filters.salesRange = values.map(Number);
                this.applyFilters();
            });
        }
    }

    populateDropdown(id, values) {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '<option value="">Todos</option>' + 
            values.map(value => `<option value="${value}">${value}</option>`).join('');
    }

    getValueRange(field) {
        const values = this.data.map(item => parseFloat(item[field])).filter(val => !isNaN(val));
        return { min: Math.min(...values), max: Math.max(...values) };
    }

    setupEventListeners() {
        document.getElementById('platformFilter')?.addEventListener('change', (e) => {
            this.filters.platform = e.target.value;
            this.applyFilters();
        });
        document.getElementById('genreFilter')?.addEventListener('change', (e) => {
            this.filters.genre = e.target.value;
            this.applyFilters();
        });
        document.getElementById('resetFilters')?.addEventListener('click', () => {
            this.resetFilters();
        });
        document.getElementById('exportCSV')?.addEventListener('click', () => {
            this.exportToCSV();
        });
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateTable();
            }
        });
        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (this.currentPage < Math.ceil(this.filteredData.length / this.itemsPerPage)) {
                this.currentPage++;
                this.updateTable();
            }
        });
        document.getElementById('toggleTable')?.addEventListener('click', () => {
            const icon = document.querySelector('#toggleTable i');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });
    }

    applyFilters() {
        this.showLoading('Filtrando datos...');
        setTimeout(() => {
            try {
                this.filteredData = this.data.filter(item =>
                    (!this.filters.platform || item.Platform === this.filters.platform) &&
                    (!this.filters.genre || item.Genre === this.filters.genre) &&
                    (item.Year >= this.filters.yearRange[0] && item.Year <= this.filters.yearRange[1]) &&
                    (item.Global_Sales >= this.filters.salesRange[0] && item.Global_Sales <= this.filters.salesRange[1])
                );
                this.currentPage = 1;
                this.updateTable();
                this.updateStats();
                this.updateCharts();
                this.hideLoading();
            } catch (error) {
                console.error('Error filtering:', error);
                this.showError('Error al filtrar: ' + error.message);
                this.hideLoading();
            }
        }, 100);
    }

    resetFilters() {
        document.getElementById('platformFilter').value = '';
        document.getElementById('genreFilter').value = '';
        const yearRange = this.getValueRange('Year');
        const salesRange = this.getValueRange('Global_Sales');
        this.sliders.year?.set([yearRange.min, yearRange.max]);
        this.sliders.sales?.set([0, Math.ceil(salesRange.max)]);
        this.filters = {
            platform: '',
            genre: '',
            yearRange: [yearRange.min, yearRange.max],
            salesRange: [0, Math.ceil(salesRange.max)]
        };
        this.applyFilters();
    }

    updateTable() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = this.filteredData.slice(start, end);
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = pageData.map(item => `
            <tr class="animate__animated animate__fadeIn">
                <td>${item.Name}</td>
                <td>${item.Platform}</td>
                <td>${item.Year}</td>
                <td>${item.Genre}</td>
                <td>${item.Global_Sales.toFixed(2)}</td>
            </tr>
        `).join('');
        document.getElementById('pageInfo').textContent = `Página ${this.currentPage}`;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === Math.ceil(this.filteredData.length / this.itemsPerPage);
    }

    updateStats() {
        const stats = {
            totalGames: this.filteredData.length,
            totalSales: this.filteredData.reduce((sum, item) => sum + item.Global_Sales, 0),
            platforms: [...new Set(this.filteredData.map(item => item.Platform))].length,
            genres: [...new Set(this.filteredData.map(item => item.Genre))].length
        };
        document.getElementById('totalGames').textContent = stats.totalGames.toLocaleString('es');
        document.getElementById('totalSales').textContent = stats.totalSales.toFixed(2) + 'M';
        document.getElementById('platformCount').textContent = stats.platforms.toLocaleString('es');
        document.getElementById('genreCount').textContent = stats.genres.toLocaleString('es');
    }

    updateCharts() {
        Chart.defaults.font.family = "'Exo 2', sans-serif";
        Chart.defaults.color = '#B0B7C3';
        Chart.defaults.animation = {
            duration: 1500,
            easing: 'easeOutBounce'
        };

        // Ventas por Región (Pie)
        const regionData = [
            this.filteredData.reduce((sum, item) => sum + item.NA_Sales, 0),
            this.filteredData.reduce((sum, item) => sum + item.EU_Sales, 0),
            this.filteredData.reduce((sum, item) => sum + item.JP_Sales, 0),
            this.filteredData.reduce((sum, item) => sum + item.Other_Sales, 0)
        ];
        if (regionData.some(val => val > 0)) {
            this.createPieChart('salesByRegionPie', {
                labels: ['Norteamérica', 'Europa', 'Japón', 'Otros'],
                data: regionData
            });
        } else {
            this.clearChart('salesByRegionPie', 'No hay datos para Ventas por Región');
        }

        // Top 5 Juegos (Bar)
        const topGames = this.filteredData.sort((a, b) => b.Global_Sales - a.Global_Sales).slice(0, 5);
        if (topGames.length > 0) {
            this.createBarChart('topGamesBar', {
                labels: topGames.map(item => item.Name.slice(0, 20)),
                data: topGames.map(item => item.Global_Sales)
            });
        } else {
            this.clearChart('topGamesBar', 'No hay datos para Top 5 Juegos');
        }

        // Ventas por Plataforma (Bar)
        const platformSales = [...new Set(this.filteredData.map(item => item.Platform))]
            .map(platform => ({
                name: platform,
                value: this.filteredData.filter(item => item.Platform === platform)
                    .reduce((sum, item) => sum + item.Global_Sales, 0)
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        if (platformSales.length > 0) {
            this.createBarChart('salesByPlatformBar', {
                labels: platformSales.map(item => item.name),
                data: platformSales.map(item => item.value)
            });
        } else {
            this.clearChart('salesByPlatformBar', 'No hay datos para Ventas por Plataforma');
        }

        // Ventas a Través del Tiempo (Line)
        const yearlyData = [...new Set(this.filteredData.map(item => item.Year))].sort()
            .map(year => ({
                period: year,
                value: this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + item.Global_Sales, 0)
            }));
        if (yearlyData.length > 0) {
            this.createLineChart('salesOverTimeLine', {
                labels: yearlyData.map(item => item.period),
                data: yearlyData.map(item => item.value)
            });
        } else {
            this.clearChart('salesOverTimeLine', 'No hay datos para Ventas a Través del Tiempo');
        }

        // Ventas por Género (Radar)
        const genres = [...new Set(this.filteredData.map(item => item.Genre))].slice(0, 5);
        const radarData = [
            {
                label: 'Norteamérica',
                data: genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + item.NA_Sales, 0)),
                color: CONFIG.colors.secondary[0]
            },
            {
                label: 'Europa',
                data: genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + item.EU_Sales, 0)),
                color: CONFIG.colors.secondary[1]
            },
            {
                label: 'Japón',
                data: genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + item.JP_Sales, 0)),
                color: CONFIG.colors.secondary[2]
            }
        ];
        if (genres.length > 0 && radarData.some(dataset => dataset.data.some(val => val > 0))) {
            this.createRadarChart('salesByGenreRadar', {
                labels: genres,
                datasets: radarData
            });
        } else {
            this.clearChart('salesByGenreRadar', 'No hay datos para Ventas por Género');
        }

        // Ventas por Región Apiladas (Stacked Area)
        const years = [...new Set(this.filteredData.map(item => item.Year))].sort();
        const stackedData = [
            {
                label: 'Norteamérica',
                data: years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + item.NA_Sales, 0)),
                color: CONFIG.colors.primary[0]
            },
            {
                label: 'Europa',
                data: years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + item.EU_Sales, 0)),
                color: CONFIG.colors.primary[1]
            },
            {
                label: 'Japón',
                data: years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + item.JP_Sales, 0)),
                color: CONFIG.colors.primary[2]
            },
            {
                label: 'Otros',
                data: years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + item.Other_Sales, 0)),
                color: CONFIG.colors.primary[3]
            }
        ];
        if (years.length > 0 && stackedData.some(dataset => dataset.data.some(val => val > 0))) {
            this.createStackedAreaChart('stackedSalesArea', {
                labels: years,
                datasets: stackedData
            });
        } else {
            this.clearChart('stackedSalesArea', 'No hay datos para Ventas por Región (Apiladas)');
        }
    }

    createGradient(ctx, chartArea, color) {
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, color + '33');
        gradient.addColorStop(1, color);
        return gradient;
    }

    clearChart(id, message) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) {
            this.charts[id].destroy();
            delete this.charts[id];
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#B0B7C3';
        ctx.font = "16px 'Exo 2', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    }

    createPieChart(id, { labels, data }) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(canvas, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: CONFIG.colors.primary,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const value = context.raw;
                                const total = context.chart.data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${context.label}: ${value.toFixed(2)}M (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutElastic',
                    delay: 200
                }
            }
        });
    }

    createBarChart(id, { labels, data }) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Ventas Globales (M)',
                    data,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return CONFIG.colors.primary[0];
                        return this.createGradient(ctx, chartArea, CONFIG.colors.primary[0]);
                    },
                    borderWidth: 0,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: id === 'topGamesBar' ? 'y' : 'x',
                scales: {
                    x: { beginAtZero: true, grid: { display: false } },
                    y: { beginAtZero: true, grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => `${context.label}: ${context.raw.toFixed(2)}M`
                        }
                    }
                },
                animation: {
                    y: {
                        from: 0,
                        easing: 'easeOutBounce',
                        duration: 1500,
                        delay: 300
                    }
                }
            }
        });
    }

    createLineChart(id, { labels, data }) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Ventas Globales (M)',
                    data,
                    borderColor: CONFIG.colors.primary[0],
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return CONFIG.colors.primary[0] + '33';
                        return this.createGradient(ctx, chartArea, CONFIG.colors.primary[0]);
                    },
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: CONFIG.colors.accent,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Año' }, grid: { display: false } },
                    y: { title: { display: true, text: 'Ventas (M)' }, beginAtZero: true }
                },
                plugins: {
                    legend: { display: false }
                },
                animation: {
                    y: {
                        from: 0,
                        easing: 'easeOutQuad',
                        duration: 1500,
                        delay: 400
                    },
                    tension: {
                        from: 0,
                        to: 0.3,
                        duration: 1000
                    }
                }
            }
        });
    }

    createRadarChart(id, { labels, datasets }) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(canvas, {
            type: 'radar',
            data: {
                labels,
                datasets: datasets.map(dataset => ({
                    label: dataset.label,
                    data: dataset.data,
                    backgroundColor: dataset.color + '33',
                    borderColor: dataset.color,
                    borderWidth: 2,
                    pointBackgroundColor: dataset.color
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: 'rgba(124, 77, 255, 0.2)' },
                        angleLines: { color: 'rgba(124, 77, 255, 0.2)' }
                    }
                },
                plugins: {
                    legend: { position: 'bottom' }
                },
                animation: {
                    scale: {
                        from: 0,
                        easing: 'easeOutElastic',
                        duration: 1500,
                        delay: 500
                    }
                }
            }
        });
    }

    createStackedAreaChart(id, { labels, datasets }) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (this.charts[id]) this.charts[id].destroy();
        this.charts[id] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: datasets.map(dataset => ({
                    label: dataset.label,
                    data: dataset.data,
                    backgroundColor: dataset.color + '66',
                    borderColor: dataset.color,
                    borderWidth: 1,
                    fill: 'stack'
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Año' }, grid: { display: false } },
                    y: { title: { display: true, text: 'Ventas (M)' }, beginAtZero: true, stacked: true }
                },
                plugins: {
                    legend: { position: 'bottom' }
                },
                animation: {
                    y: {
                        from: 0,
                        easing: 'easeOutQuad',
                        duration: 1500,
                        delay: 600
                    }
                }
            }
        });
    }

    exportToCSV() {
        if (!this.filteredData.length) {
            this.showError('No hay datos para exportar');
            return;
        }
        const header = ['Name', 'Platform', 'Year', 'Genre', 'Global_Sales'];
        const rows = this.filteredData.map(item =>
            header.map(key => `"${String(item[key]).replace(/"/g, '""')}"`).join(',')
        );
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'videogames_export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showLoading(message) {
        const loader = document.getElementById('loaderContainer');
        if (loader) {
            document.querySelector('.loading-text').textContent = message;
            loader.style.display = 'flex';
        }
    }

    hideLoading() {
        const loader = document.getElementById('loaderContainer');
        if (loader) {
            loader.style.opacity = 0;
            setTimeout(() => {
                loader.style.display = 'none';
                loader.style.opacity = 1;
            }, 500);
        }
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            errorElement.classList.add('animate__animated', 'animate__shakeX');
            setTimeout(() => {
                errorElement.style.display = 'none';
                errorElement.classList.remove('animate__animated', 'animate__shakeX');
            }, 5000);
        }
    }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());