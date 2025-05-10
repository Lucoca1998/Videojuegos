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
        console.log('Inicializando la aplicación...');
        try {
            this.showLoading('Iniciando...');
            await this.loadData();
            this.setupFilters();
            this.applyFilters();
            this.setupEventListeners();
            this.hideLoading();
        } catch (error) {
            console.error('Error al iniciar:', error);
            this.showError('Error al cargar datos: ' + error.message);
            this.loadFallbackData();
            this.setupFilters();
            this.applyFilters();
        }
    }

    async loadData() {
        console.log('Intentando cargar datos desde CSV...');
        try {
            const response = await fetch('video_games_sales.csv'); // Coloca el archivo en tu directorio
            if (!response.ok) throw new Error('Fallo al cargar el CSV local');
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            console.log('Datos cargados desde CSV local:', this.data.length, 'registros');
        } catch (localError) {
            console.warn('Fallo al cargar CSV local, intentando remoto:', localError);
            try {
                const response = await fetch('https://raw.githubusercontent.com/rudyluis/DashboardJS/refs/heads/main/video_games_sales.csv');
                if (!response.ok) throw new Error('Fallo al cargar el CSV remoto');
                const csvText = await response.text();
                this.data = this.parseCSV(csvText);
                console.log('Datos cargados desde CSV remoto:', this.data.length, 'registros');
            } catch (error) {
                console.error('Fallo al cargar CSV remoto, usando datos de respaldo:', error);
                this.loadFallbackData();
            }
        }
    }



    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        const data = lines.slice(1).map(line => {
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let char of line + ',') {
                if (char === '"' && line[line.indexOf(char) - 1] !== '\\') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            return headers.reduce((obj, header, index) => {
                const value = values[index] ? values[index].replace(/^"|"$/g, '') : '';
                obj[header] = isNaN(value) || value === '' ? value : Number(value);
                return obj;
            }, {});
        }).filter(item => item.Name && !isNaN(item.Year) && !isNaN(item.Global_Sales));
        return data;
    }

    setupFilters() {
        console.log('Configurando filtros...');
        this.populateDropdown('platformFilter', [...new Set(this.data.map(item => item.Platform))].sort());
        this.populateDropdown('genreFilter', [...new Set(this.data.map(item => item.Genre))].sort());

        const yearRange = this.getValueRange('Year');
        this.filters.yearRange = [yearRange.min, yearRange.max];
        const yearSlider = document.getElementById('yearSlider');
        if (yearSlider && typeof noUiSlider !== 'undefined') {
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
        } else {
            console.warn('yearSlider o noUiSlider no disponible');
        }

        const salesRange = this.getValueRange('Global_Sales');
        this.filters.salesRange = [0, Math.ceil(salesRange.max)];
        const salesSlider = document.getElementById('salesSlider');
        if (salesSlider && typeof noUiSlider !== 'undefined') {
            this.sliders.sales = noUiSlider.create(salesSlider, {
                start: [0, Math.ceil(salesRange.max)],
                connect: true,
                step: 0.1,
                range: { 'min': 0, 'max': Math.ceil(salesRange.max) },
                format: { to: value => Number(value).toFixed(1), from: value => Number(value) },
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
        } else {
            console.warn('salesSlider o noUiSlider no disponible');
        }
    }

    populateDropdown(id, values) {
        const select = document.getElementById(id);
        if (!select) {
            console.warn(`Elemento ${id} no encontrado`);
            return;
        }
        select.innerHTML = '<option value="">Todos</option>' +
            values.map(value => `<option value="${value}">${value}</option>`).join('');
    }

    getValueRange(field) {
        const values = this.data.map(item => parseFloat(item[field])).filter(val => !isNaN(val));
        return { min: Math.min(...values), max: Math.max(...values) };
    }

    setupEventListeners() {
        console.log('Configurando eventos...');
        const platformFilter = document.getElementById('platformFilter');
        if (platformFilter) {
            platformFilter.addEventListener('change', (e) => {
                this.filters.platform = e.target.value;
                this.applyFilters();
            });
        }
        const genreFilter = document.getElementById('genreFilter');
        if (genreFilter) {
            genreFilter.addEventListener('change', (e) => {
                this.filters.genre = e.target.value;
                this.applyFilters();
            });
        }
        const resetFilters = document.getElementById('resetFilters');
        if (resetFilters) {
            resetFilters.addEventListener('click', () => {
                this.resetFilters();
            });
        }
        const exportCSV = document.getElementById('exportCSV');
        if (exportCSV) {
            exportCSV.addEventListener('click', () => {
                this.exportToCSV();
            });
        }
        const prevPage = document.getElementById('prevPage');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.updateTable();
                    this.updateCharts();
                }
            });
        }
        const nextPage = document.getElementById('nextPage');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (this.currentPage < Math.ceil(this.filteredData.length / this.itemsPerPage)) {
                    this.currentPage++;
                    this.updateTable();
                    this.updateCharts();
                }
            });
        }
        const toggleTable = document.getElementById('toggleTable');
        if (toggleTable) {
            toggleTable.addEventListener('click', () => {
                const icon = document.querySelector('#toggleTable i');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-up');
            });
        }
    }

    applyFilters() {
        console.log('Aplicando filtros...');
        this.showLoading('Filtrando datos...');
        try {
            this.filteredData = this.data.filter(item =>
                (!this.filters.platform || item.Platform === this.filters.platform) &&
                (!this.filters.genre || item.Genre === this.filters.genre) &&
                (item.Year >= this.filters.yearRange[0] && item.Year <= this.filters.yearRange[1]) &&
                (item.Global_Sales >= this.filters.salesRange[0] && item.Global_Sales <= this.filters.salesRange[1])
            );
            console.log('Datos filtrados:', this.filteredData.length, 'registros');
            this.currentPage = 1;
            this.updateTable();
            this.updateStats();
            this.updateCharts();
            this.hideLoading();
        } catch (error) {
            console.error('Error al filtrar:', error);
            this.showError('Error al filtrar: ' + error.message);
            this.hideLoading();
        }
    }

    resetFilters() {
        console.log('Reseteando filtros...');
        const platformFilter = document.getElementById('platformFilter');
        const genreFilter = document.getElementById('genreFilter');
        if (platformFilter) platformFilter.value = '';
        if (genreFilter) genreFilter.value = '';
        const yearRange = this.getValueRange('Year');
        const salesRange = this.getValueRange('Global_Sales');
        if (this.sliders.year) this.sliders.year.set([yearRange.min, yearRange.max]);
        if (this.sliders.sales) this.sliders.sales.set([0, Math.ceil(salesRange.max)]);
        this.filters = {
            platform: '',
            genre: '',
            yearRange: [yearRange.min, yearRange.max],
            salesRange: [0, Math.ceil(salesRange.max)]
        };
        this.applyFilters();
    }

    updateTable() {
        console.log('Actualizando tabla...');
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = this.filteredData.slice(start, end);
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = pageData.map(item => `
                <tr class="animate__animated animate__fadeIn">
                    <td>${item.Name || 'N/A'}</td>
                    <td>${item.Platform || 'N/A'}</td>
                    <td>${item.Year || 'N/A'}</td>
                    <td>${item.Genre || 'N/A'}</td>
                    <td>${(item.Global_Sales || 0).toFixed(2)}</td>
                </tr>
            `).join('');
        }
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Página ${this.currentPage} de ${Math.ceil(this.filteredData.length / this.itemsPerPage)}`;
        }
        const prevPage = document.getElementById('prevPage');
        const nextPage = document.getElementById('nextPage');
        if (prevPage) prevPage.disabled = this.currentPage === 1;
        if (nextPage) nextPage.disabled = this.currentPage === Math.ceil(this.filteredData.length / this.itemsPerPage);
    }

    updateStats() {
        console.log('Actualizando estadísticas...');
        const stats = {
            totalGames: this.filteredData.length,
            totalSales: this.filteredData.reduce((sum, item) => sum + (item.Global_Sales || 0), 0),
            platforms: [...new Set(this.filteredData.map(item => item.Platform))].length,
            genres: [...new Set(this.filteredData.map(item => item.Genre))].length
        };
        const totalGames = document.getElementById('totalGames');
        const totalSales = document.getElementById('totalSales');
        const platformCount = document.getElementById('platformCount');
        const genreCount = document.getElementById('genreCount');
        if (totalGames) totalGames.textContent = stats.totalGames.toLocaleString('es');
        if (totalSales) totalSales.textContent = stats.totalSales.toFixed(2) + 'M';
        if (platformCount) platformCount.textContent = stats.platforms.toLocaleString('es');
        if (genreCount) genreCount.textContent = stats.genres.toLocaleString('es');
    }

    updateCharts() {
        console.log('Actualizando gráficos...');
        if (typeof Chart === 'undefined') {
            console.error('Chart.js no está disponible');
            this.showError('No se pudo cargar Chart.js. Los gráficos no estarán disponibles.');
            return;
        }

        Chart.defaults.font.family = "'Exo 2', sans-serif";
        Chart.defaults.color = '#B0B7C3';
        Chart.defaults.animation = {
            duration: 1500,
            easing: 'easeOutBounce'
        };

        // Ventas por Región (Pie)
        let regionData = [
            this.filteredData.reduce((sum, item) => sum + (item.NA_Sales || 0), 0),
            this.filteredData.reduce((sum, item) => sum + (item.EU_Sales || 0), 0),
            this.filteredData.reduce((sum, item) => sum + (item.JP_Sales || 0), 0),
            this.filteredData.reduce((sum, item) => sum + (item.Other_Sales || 0), 0)
        ];
        const regionHasData = regionData.some(val => val > 0);
        console.log('Datos para Ventas por Región:', regionData);
        this.createOrUpdateChart('salesByRegionPie', 'pie', {
            labels: ['Norteamérica', 'Europa', 'Japón', 'Otros'],
            data: regionHasData ? regionData : [1, 1, 1, 1],
            isDefault: !regionHasData
        });

        // Top 5 Juegos (Bar)
        const topGames = this.filteredData.sort((a, b) => (b.Global_Sales || 0) - (a.Global_Sales || 0)).slice(0, 5);
        console.log('Top 5 Juegos:', topGames);
        this.createOrUpdateChart('topGamesBar', 'bar', {
            labels: topGames.length > 0 ? topGames.map(item => (item.Name || '').slice(0, 20)) : ['Sin datos'],
            data: topGames.length > 0 ? topGames.map(item => item.Global_Sales || 0) : [0],
            isDefault: topGames.length === 0
        });

        // Ventas por Plataforma (Bar)
        const platformSales = [...new Set(this.filteredData.map(item => item.Platform))]
            .map(platform => ({
                name: platform,
                value: this.filteredData.filter(item => item.Platform === platform)
                    .reduce((sum, item) => sum + (item.Global_Sales || 0), 0)
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
        console.log('Ventas por Plataforma:', platformSales);
        this.createOrUpdateChart('salesByPlatformBar', 'bar', {
            labels: platformSales.length > 0 ? platformSales.map(item => item.name) : ['Sin datos'],
            data: platformSales.length > 0 ? platformSales.map(item => item.value) : [0],
            isDefault: platformSales.length === 0
        });

        // Ventas a Través del Tiempo (Line)
        const yearlyData = [...new Set(this.filteredData.map(item => item.Year))].sort()
            .map(year => ({
                period: year,
                value: this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + (item.Global_Sales || 0), 0)
            }));
        console.log('Ventas a Través del Tiempo:', yearlyData);
        this.createOrUpdateChart('salesOverTimeLine', 'line', {
            labels: yearlyData.length > 0 ? yearlyData.map(item => item.period) : ['Sin datos'],
            data: yearlyData.length > 0 ? yearlyData.map(item => item.value) : [0],
            isDefault: yearlyData.length === 0
        });

        // Ventas por Género (Radar)
        const genres = [...new Set(this.filteredData.map(item => item.Genre))].slice(0, 5);
        const radarData = [
            {
                label: 'Norteamérica',
                data: genres.length > 0 ? genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + (item.NA_Sales || 0), 0)) : [0],
                color: '#FF69B4'
            },
            {
                label: 'Europa',
                data: genres.length > 0 ? genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + (item.EU_Sales || 0), 0)) : [0],
                color: '#00BFFF'
            },
            {
                label: 'Japón',
                data: genres.length > 0 ? genres.map(genre => this.filteredData.filter(item => item.Genre === genre)
                    .reduce((sum, item) => sum + (item.JP_Sales || 0), 0)) : [0],
                color: '#FFA500'
            }
        ];
        const radarHasData = genres.length > 0 && radarData.some(dataset => dataset.data.some(val => val > 0));
        console.log('Ventas por Género:', radarData);
        this.createOrUpdateChart('salesByGenreRadar', 'radar', {
            labels: genres.length > 0 ? genres : ['Sin datos'],
            datasets: radarData,
            isDefault: !radarHasData
        });

        // Ventas por Región Apiladas (Stacked Area)
        const years = [...new Set(this.filteredData.map(item => item.Year))].sort();
        const stackedData = [
            {
                label: 'Norteamérica',
                data: years.length > 0 ? years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + (item.NA_Sales || 0), 0)) : [0],
                color: '#7C4DFF'
            },
            {
                label: 'Europa',
                data: years.length > 0 ? years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + (item.EU_Sales || 0), 0)) : [0],
                color: '#4FC3F7'
            },
            {
                label: 'Japón',
                data: years.length > 0 ? years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + (item.JP_Sales || 0), 0)) : [0],
                color: '#FF5252'
            },
            {
                label: 'Otros',
                data: years.length > 0 ? years.map(year => this.filteredData.filter(item => item.Year === year)
                    .reduce((sum, item) => sum + (item.Other_Sales || 0), 0)) : [0],
                color: '#B9F6CA'
            }
        ];
        const stackedHasData = years.length > 0 && stackedData.some(dataset => dataset.data.some(val => val > 0));
        console.log('Ventas por Región Apiladas:', stackedData);
        this.createOrUpdateChart('stackedSalesArea', 'line', {
            labels: years.length > 0 ? years : ['Sin datos'],
            datasets: stackedData,
            isDefault: !stackedHasData
        });
    }

    createOrUpdateChart(id, type, { labels, data = [], datasets = [], isDefault }) {
        const canvas = document.getElementById(id);
        if (!canvas) {
            console.warn(`Canvas ${id} no encontrado`);
            return;
        }

        if (this.charts[id]) {
            console.log(`Destruyendo gráfico ${id} para actualizar...`);
            this.charts[id].destroy();
        }

        let chartData = {};
        let options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = Array.isArray(data) ? context.raw : context.dataset.data[context.dataIndex];
                            const prefix = isDefault ? '[Sin datos disponibles] ' : '';
                            return `${prefix}${context.label}: ${value.toFixed(2)}M`;
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutBounce'
            }
        };

        switch (type) {
            case 'pie':
                chartData = {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: ['#7C4DFF', '#4FC3F7', '#FF5252', '#B9F6CA'],
                        borderWidth: 0
                    }]
                };
                options.animation = {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500,
                    easing: 'easeOutElastic'
                };
                break;

            case 'bar':
                chartData = {
                    labels,
                    datasets: [{
                        label: 'Ventas Globales (M)',
                        data,
                        backgroundColor: '#7C4DFF',
                        borderWidth: 0,
                        borderRadius: 5
                    }]
                };
                options = {
                    ...options,
                    indexAxis: id === 'topGamesBar' ? 'y' : 'x',
                    scales: {
                        x: { beginAtZero: true, grid: { display: false } },
                        y: { beginAtZero: true, grid: { display: false } }
                    },
                    animation: {
                        y: { from: 0, easing: 'easeOutBounce', duration: 1500 }
                    }
                };
                break;

            case 'line':
                chartData = {
                    labels,
                    datasets: [{
                        label: 'Ventas Globales (M)',
                        data: data,
                        borderColor: '#7C4DFF',
                        backgroundColor: '#7C4DFF66',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: '#FF5252',
                        fill: true
                    }, ...datasets.map(dataset => ({
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: dataset.color + '66',
                        borderColor: dataset.color,
                        borderWidth: 1,
                        fill: 'stack'
                    }))]
                };
                options = {
                    ...options,
                    scales: {
                        x: { title: { display: true, text: 'Año' }, grid: { display: false } },
                        y: { title: { display: true, text: 'Ventas (M)' }, beginAtZero: true, stacked: id === 'stackedSalesArea' }
                    },
                    animation: {
                        y: { from: 0, easing: 'easeOutQuad', duration: 1500 }
                    }
                };
                break;

            case 'radar':
                chartData = {
                    labels,
                    datasets: datasets.map(dataset => ({
                        label: dataset.label,
                        data: dataset.data,
                        backgroundColor: dataset.color + '33',
                        borderColor: dataset.color,
                        borderWidth: 2,
                        pointBackgroundColor: dataset.color
                    }))
                };
                options = {
                    ...options,
                    scales: {
                        r: {
                            beginAtZero: true,
                            grid: { color: 'rgba(124, 77, 255, 0.2)' },
                            angleLines: { color: 'rgba(124, 77, 255, 0.2)' }
                        }
                    },
                    animation: {
                        scale: { from: 0, easing: 'easeOutElastic', duration: 1500 }
                    }
                };
                break;
        }

        try {
            this.charts[id] = new Chart(canvas, {
                type: type,
                data: chartData,
                options: options
            });
            console.log(`Gráfico ${id} creado con éxito`);
        } catch (error) {
            console.error(`Error al crear el gráfico ${id}:`, error);
            this.showError(`Error al renderizar el gráfico ${id}.`);
        }
    }

    exportToCSV() {
        if (!this.filteredData.length) {
            this.showError('No hay datos para exportar');
            return;
        }
        const header = ['Name', 'Platform', 'Year', 'Genre', 'Global_Sales', 'NA_Sales', 'EU_Sales', 'JP_Sales', 'Other_Sales'];
        const rows = this.filteredData.map(item =>
            header.map(key => `"${String(item[key] || '').replace(/"/g, '""')}"`).join(',')
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
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no está disponible');
        document.getElementById('errorMessage').textContent = 'Error: No se pudo cargar Chart.js.';
        document.getElementById('errorMessage').style.display = 'block';
        return;
    }
    if (typeof noUiSlider === 'undefined') {
        console.error('noUiSlider no está disponible');
        document.getElementById('errorMessage').textContent = 'Error: No se pudo cargar noUiSlider.';
        document.getElementById('errorMessage').style.display = 'block';
    }
    app.init();
});